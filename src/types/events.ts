/** Shared correlation identifier — the cart ID that links order and payment events. */
export type CorrelationId = string;

/** Event names used for Durable Functions external event correlation. */
export const EventNames = {
  OrderCompleted: 'OrderComplete',
  OrderCreated: 'OrderCreated',
  PaymentCaptured: 'PaymentCaptured',
  PaymentEvent: 'PaymentEvent',
  OrderOpened: 'OrderOpened',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
