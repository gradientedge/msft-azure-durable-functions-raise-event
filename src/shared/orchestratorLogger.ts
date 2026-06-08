import { OrchestrationContext } from 'durable-functions';

/**
 * Replay-aware logger for Durable Functions orchestrators.
 *
 * Durable orchestrators are replayed from the beginning on every activation.
 * Without suppression, every context.log() fires again on each replay,
 * producing duplicate entries in Application Insights.
 *
 * This wrapper checks `isReplaying` internally so the orchestrator code
 * stays clean — just call `log.info(...)` instead of guarding every log.
 */
export interface OrchestratorLogger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

export function createOrchestratorLogger(
    context: OrchestrationContext,
    cartId: string,
): OrchestratorLogger {
    const props = { cartId, instanceId: context.df.instanceId };
    return {
        info(message: string, ...args: unknown[]) {
            if (!context.df.isReplaying) {
                context.log(message, props, ...args);
            }
        },
        warn(message: string, ...args: unknown[]) {
            if (!context.df.isReplaying) {
                context.warn(message, props, ...args);
            }
        },
        error(message: string, ...args: unknown[]) {
            if (!context.df.isReplaying) {
                context.error(message, props, ...args);
            }
        },
    };
}
