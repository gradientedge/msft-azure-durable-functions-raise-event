import { InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';

/** Default polling cadence and timeout for {@link waitForOrchestrationRunning}. */
export const DEFAULT_POLL_INTERVAL_MS = 100;
export const DEFAULT_MAX_WAIT_MS = 10_000;
export const DEFAULT_BACKOFF_FACTOR = 1.5;
export const DEFAULT_MAX_INTERVAL_MS = 1_000;

/**
 * Waits until a freshly started orchestration instance is observable by the
 * backend in a non-`Pending` state (i.e. `Running` or any later state),
 * before the caller raises external events against it.
 *
 * Background — quoting MSFT support / the Durable Task docs:
 *   "If raiseEvent() happens immediately after startNew(), there can be a
 *    short window where the orchestration instance is not yet fully
 *    materialized in the backend. If the event arrives during that window,
 *    it may be dropped instead of buffered."
 *   ( https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-external-events
 *     — see the "If there is no orchestration instance with the specified
 *     instance ID, the event message is discarded" note. )
 *
 * Strategy: poll `client.getStatus(instanceId)` with exponential backoff
 * until the status is no longer `Pending` (or undefined / 404), or the
 * `maxWaitMs` budget is exhausted. We deliberately treat any non-`Pending`
 * status — including `Running`, `Completed`, `Failed`, `Terminated`,
 * `Suspended`, `ContinuedAsNew` — as "materialised", because by then the
 * backend has accepted the instance and a subsequent `raiseEvent` will
 * either buffer or be a documented no-op (terminal instances ignore
 * events), but will not silently fall into the "unknown instance" hole.
 *
 * This helper is idempotent and safe to call against an already-running
 * instance (it returns immediately on the first poll).
 */
export interface WaitForRunningOptions {
  pollIntervalMs?: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  maxWaitMs?: number;
}

export async function waitForOrchestrationRunning(
  client: df.DurableClient,
  instanceId: string,
  context: InvocationContext,
  options: WaitForRunningOptions = {},
): Promise<df.OrchestrationRuntimeStatus> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS;
  const backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

  const deadline = Date.now() + maxWaitMs;
  let interval = pollIntervalMs;
  let attempt = 0;

  while (true) {
    attempt++;
    const status = await getStatusSafe(client, instanceId);
    const runtimeStatus = status?.runtimeStatus;

    if (
      runtimeStatus &&
      runtimeStatus !== df.OrchestrationRuntimeStatus.Pending
    ) {
      context.log(
        `startWaitAndContinueTrigger - [waitForOrchestrationRunning] instance materialised ${instanceId}, ${runtimeStatus}, ${attempt}`
      );
      return runtimeStatus;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `startWaitAndContinueTrigger - [waitForOrchestrationRunning] Timed out after ${maxWaitMs}ms waiting for instance '${instanceId}' to leave Pending. lastStatus=${runtimeStatus ?? 'undefined'}`,
      );
    }

    await sleep(Math.min(interval, maxIntervalMs));
    interval = Math.min(Math.ceil(interval * backoffFactor), maxIntervalMs);
  }
}

async function getStatusSafe(
  client: df.DurableClient,
  instanceId: string,
) {
  try {
    return await client.getStatus(instanceId);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.includes('HTTP 404')) return undefined;
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
