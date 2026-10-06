export const WEBHOOK_EVENTS = [
  "post.created","post.updated","post.scheduled","post.publishing","post.published","post.failed","post.cancelled",
  "account.connected","account.disconnected","media.uploaded",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}
