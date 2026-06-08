import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import * as df from 'durable-functions';
import { ContinueEventName } from '../orchestrators/waitAndContinueOrchestrator';
import { waitForOrchestrationRunning } from '../../shared/waitForOrchestrationRunning';

/**
 * HTTP trigger that starts the `waitAndContinueOrchestrator` and immediately
 * raises the `continue` external event for the new instance.
 *
 * Usage:
 *   POST /api/wait-and-continue/start
 */
async function startWaitAndContinueTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const client = df.getClient(context);

  const instanceId = await client.startNew('waitAndContinueOrchestrator');
  context.log(`startWaitAndContinueTrigger - Started waitAndContinueOrchestrator instanceId=${instanceId}`);

  // Race guard: `startNew` returns synchronously, but the instance may not
  // yet be visible to the backend. Raising the event in that window causes
  // the runtime to drop it ("no orchestration instance with the specified
  // instance ID is discarded"). Poll until the instance leaves `Pending`
  // before raising.
  const runtimeStatus = await waitForOrchestrationRunning(client, instanceId, context);
  context.log(`startWaitAndContinueTrigger - Instance ready (${runtimeStatus}) — raising '${ContinueEventName}'`);

  let eventBody: unknown = undefined;
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      eventBody = await request.json();
    } catch {
      // Ignore body parse errors — raise the event with no payload.
    }
  }

  await client.raiseEvent(instanceId, ContinueEventName, eventBody ?? { triggeredAt: new Date().toISOString() });
  context.log(`startWaitAndContinueTrigger - Raised '${ContinueEventName}' event for instanceId=${instanceId}`);

  return {
    status: 202,
    jsonBody: {
      instanceId,
      event: ContinueEventName,
      message: 'Orchestration started and continue event raised',
      statusQueryGetUri: `/runtime/webhooks/durabletask/instances/${instanceId}`,
    },
  };
}

app.http('startWaitAndContinue', {
  route: 'wait-and-continue/start',
  methods: ['POST'],
  authLevel: 'anonymous',
  extraInputs: [df.input.durableClient()],
  handler: startWaitAndContinueTrigger,
});
