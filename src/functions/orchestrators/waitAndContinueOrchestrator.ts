import * as df from 'durable-functions';
import { OrchestrationContext, OrchestrationHandler } from 'durable-functions';

export const ContinueEventName = 'continue';

/**
 * Orchestrator that:
 *   1. Runs the `waitTwoMinutes` activity (blocks ~2 minutes, no durable timer).
 *   2. Waits for an external event named `continue` before completing.
 */
const waitAndContinueOrchestrator: OrchestrationHandler = function*(
  context: OrchestrationContext,
) {
  context.log(
    `[waitAndContinueOrchestrator] Started instanceId=${context.df.instanceId}, isReplaying=${context.df.isReplaying}`,
  );

  const activityResult = yield context.df.callActivity('waitTwoMinutes', null);
  context.log(`[waitAndContinueOrchestrator] Activity completed: ${JSON.stringify(activityResult)}`);

  const eventPayload = yield context.df.waitForExternalEvent(ContinueEventName);
  context.log(`[waitAndContinueOrchestrator] Received '${ContinueEventName}' event: ${JSON.stringify(eventPayload)}`);

  return {
    isCompleted: true,
    activityResult,
    eventPayload,
  };
};

df.app.orchestration('waitAndContinueOrchestrator', waitAndContinueOrchestrator);
