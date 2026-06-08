import { OrchestrationContext } from 'durable-functions';
import { Task } from 'durable-functions';

export interface TrackedRetryOptions {
  /** First retry delay in milliseconds. */
  firstRetryIntervalMs: number;
  /** Maximum number of attempts (including the first). */
  maxAttempts: number;
  /** Multiplier applied to the delay after each failure. */
  backoffCoefficient: number;
}

export const DEFAULT_RETRY_OPTIONS: TrackedRetryOptions = {
  firstRetryIntervalMs: 5000,
  maxAttempts: 3,
  backoffCoefficient: 2.0,
};

/**
 * Calls an activity with retry, injecting `_attempt` and `_maxAttempts`
 * into the input so the activity can log which retry it's on.
 *
 * Must be used with `yield*` inside an orchestrator generator function:
 * ```
 * const result = yield* callActivityWithTrackedRetry(context, 'myActivity', input, options);
 * ```
 */
export function* callActivityWithTrackedRetry(
  context: OrchestrationContext,
  activityName: string,
  input: Record<string, unknown>,
  options: TrackedRetryOptions = DEFAULT_RETRY_OPTIONS,
): Generator<Task, unknown, any> {
  let lastError: unknown;
  let delayMs = options.firstRetryIntervalMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = yield context.df.callActivity(activityName, {
        ...input,
        _attempt: attempt,
        _maxAttempts: options.maxAttempts,
      });
      return result;
    } catch (error) {
      lastError = error;

      if (attempt < options.maxAttempts) {
        const retryDeadline = new Date(context.df.currentUtcDateTime);
        retryDeadline.setMilliseconds(retryDeadline.getMilliseconds() + delayMs);
        yield context.df.createTimer(retryDeadline);
        delayMs = Math.round(delayMs * options.backoffCoefficient);
      }
    }
  }

  throw lastError;
}
