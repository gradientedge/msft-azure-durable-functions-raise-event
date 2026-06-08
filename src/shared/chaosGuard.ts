import { DurableClient, EntityId, EntityStateResponse } from 'durable-functions';
import { InvocationContext } from '@azure/functions';

/**
 * Reads the current chaos counter for the given entity key, signals an
 * increment (fire-and-forget), then throws if the count doesn't land on
 * the success threshold.
 *
 * Call this at the top of any activity that should participate in chaos
 * testing. The entity key should be cart-scoped so each cart gets its own
 * independent counter (e.g. `order-number-{cartId}`).
 *
 * @param client   DurableClient obtained via `df.getClient(context)`
 * @param entityKey  Key for the chaosCounter entity instance (e.g. `order-number-abc123`)
 * @param threshold  The activity succeeds every Nth call (e.g. 4 → succeed on 4, 8, 12 …)
 * @param context  InvocationContext for logging
 * @returns The incremented count value
 */
export async function chaosGuard(
  client: DurableClient,
  entityKey: string,
  threshold: number,
  context: InvocationContext,
  cartId: string,
): Promise<number> {
  if (process.env.CHAOS_ENABLED !== 'true') {
    return 0;
  }

  const entityId = new EntityId('chaosCounter', entityKey);

  // Read current state
  const state: EntityStateResponse<number> = await client.readEntityState(entityId);
  const current = state.entityExists ? (state.entityState ?? 0) : 0;
  const next = current + 1;

  // Signal increment so the entity stays in sync for the next caller
  await client.signalEntity(entityId, 'increment');

  context.log(
    `[CHAOS] entityKey=${entityKey}, count=${next}, threshold=${threshold}, willFail=${next % threshold !== 0}`,
    { cartId, entityKey, count: next, threshold, willFail: next % threshold !== 0 },
  );

  if (next % threshold !== 0) {
    throw new Error(`[CHAOS] ${entityKey} deliberate failure (count=${next}, succeeds every ${threshold}th)`);
  }

  return next;
}
