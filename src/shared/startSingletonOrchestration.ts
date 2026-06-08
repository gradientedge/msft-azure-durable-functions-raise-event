import { InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { buildInstanceId } from './instanceId';
import { EventName } from '../types/events';
import { waitForOrchestrationRunning } from './waitForOrchestrationRunning';

/**
 * Starts a singleton orchestration (per correlation key) and raises a typed
 * external event with data.
 *
 * Implements the Durable Task singleton pattern documented at:
 * https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-singletons
 *
 * 1. Build a deterministic instanceId from `${orchestratorName}-${correlationKey}`.
 * 2. Inspect existing status. Only call startNew if there is no instance, or
 *    the existing instance is in a terminal state (Completed/Failed/Terminated).
 * 3. Raise the named external event with payload — orchestrator receives it
 *    via waitForExternalEvent(eventName).
 */
export async function startSingletonOrJoin(
  orchestratorName: string,
  context: InvocationContext,
  correlationKey: string,
  eventName: EventName,
  eventData: unknown,
  startInput: unknown = { orderId: correlationKey },
): Promise<string> {
  const client = df.getClient(context);
  const instanceId = buildInstanceId(orchestratorName, correlationKey);

  const existing = await getStatusOrUndefined(client, instanceId);
  const runtimeStatus = existing?.runtimeStatus;
  const isTerminal =
    !existing ||
    runtimeStatus === df.OrchestrationRuntimeStatus.Completed ||
    runtimeStatus === df.OrchestrationRuntimeStatus.Failed ||
    runtimeStatus === df.OrchestrationRuntimeStatus.Terminated;

  if (isTerminal) {
    try {
      await client.startNew(orchestratorName, { instanceId, input: startInput });
      context.log(`[${eventName}] Started singleton orchestration`, {
        correlationKey,
        instanceId,
        orchestratorName,
      });
      // Avoid the start/raiseEvent race: ensure the instance has left
      // `Pending` (i.e. has been materialised in the backend) before we
      // raise the external event. Otherwise the runtime can silently
      // discard the event with the "no orchestration instance with the
      // specified instance ID" rule.
      await waitForOrchestrationRunning(client, instanceId, context);
    } catch (error: unknown) {
      if (!isConflictError(error)) throw error;
      context.log(`[${eventName}] Singleton already exists (race) — joining`, {
        correlationKey,
        instanceId,
      });
    }
  } else {
    context.log(`[${eventName}] Singleton already running (${runtimeStatus}) — joining`, {
      correlationKey,
      instanceId,
      runtimeStatus,
    });
  }

  await client.raiseEvent(instanceId, eventName, eventData);
  context.log(`[${eventName}] Raised event with data`, { correlationKey, instanceId });

  return instanceId;
}

function isConflictError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const statusCode = (error as Record<string, unknown>).statusCode;
    if (statusCode === 409) return true;
    const message = (error as Error).message ?? '';
    if (message.includes('already exists') || message.includes('conflict')) return true;
  }
  return false;
}

/**
 * `DurableClient.getStatus()` throws on HTTP 404 instead of returning
 * undefined. For the singleton check we want a missing instance to be
 * indistinguishable from a terminal one, so swallow the 404 here.
 */
async function getStatusOrUndefined(
  client: df.DurableClient,
  instanceId: string,
) {
  // this shouldn't thorw for any reason other than the instance not existing, but be defensive
  try {
    return await client.getStatus(instanceId);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.includes('HTTP 404')) return undefined;
    throw error;
  }
}
