export function notificationIdempotencyKey(dedupeKey: string) {
  return `socialmedia-notification:v1:${dedupeKey}`.slice(0, 256);
}
