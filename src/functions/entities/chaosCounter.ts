import * as df from 'durable-functions';
import { EntityHandler } from 'durable-functions';

/**
 * Persistent counter used for deterministic chaos/error injection.
 *
 * Each activity that participates in chaos testing gets its own entity
 * instance (keyed by activity name). The orchestrator increments the
 * counter before calling the activity and passes the count so the
 * activity can decide whether to fail.
 *
 * Operations:
 *   - increment  → adds 1, returns the new count
 *   - get        → returns the current count without changing it
 *   - reset      → sets the count back to 0
 */
const chaosCounter: EntityHandler<number> = (context) => {
  const current = context.df.getState(() => 0) ?? 0;

  switch (context.df.operationName) {
    case 'increment': {
      const next = current + 1;
      context.df.setState(next);
      context.df.return(next);
      break;
    }
    case 'get':
      context.df.return(current);
      break;
    case 'reset':
      context.df.setState(0);
      break;
    default:
      throw new Error(`Unknown operation: ${context.df.operationName}`);
  }
};

df.app.entity('chaosCounter', chaosCounter);
