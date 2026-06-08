import * as df from 'durable-functions';
import { ActivityHandler } from 'durable-functions';
import { InvocationContext } from '@azure/functions';

const WAIT_MS = 1 * 30 * 1000;

/**
 * Activity that blocks for 30 minutes using setTimeout (not a durable timer).
 *
 * Because activities run outside the orchestrator replay model, using a
 * plain setTimeout here is safe — the orchestrator simply awaits the
 * activity's completion.
 */
const waitTwoMinutes: ActivityHandler = async (
  _input: unknown,
  context: InvocationContext,
): Promise<{ waitedMs: number }> => {
  context.log(`[waitTwoMinutes] Sleeping for ${WAIT_MS}ms (invocationId=${context.invocationId})`);
  await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
  context.log(`[waitTwoMinutes] Done sleeping`);
  return { waitedMs: WAIT_MS };
};

df.app.activity('waitTwoMinutes', {
  handler: waitTwoMinutes,
});
