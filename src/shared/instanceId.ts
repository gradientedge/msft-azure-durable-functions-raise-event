import { CorrelationId } from '../types/events';

/**
 * Builds a deterministic orchestration instance ID from orchestrator name and cart ID.
 * Each orchestrator gets its own namespace so multiple orchestrators can
 * correlate on the same cartId without instanceId collisions.
 */
export function buildInstanceId(orchestratorName: string, cartId: CorrelationId): string {
    return `${orchestratorName}-${cartId}`;
}
