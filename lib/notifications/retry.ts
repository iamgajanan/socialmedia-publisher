const MAX_BACKOFF_SECONDS = 60 * 60;
export const MAX_NOTIFICATION_ATTEMPTS = 5;

export function getNotificationBackoffSeconds(attempt: number) {
  const normalized = Math.max(1, Math.floor(attempt));
  return Math.min(MAX_BACKOFF_SECONDS, 60 * 2 ** Math.max(0, normalized - 1));
}

export function getNextNotificationAttemptAt(attempt: number, now = new Date()) {
  return new Date(now.getTime() + getNotificationBackoffSeconds(attempt) * 1000);
}

export function canRetryNotification(attempt: number) {
  return attempt < MAX_NOTIFICATION_ATTEMPTS;
}
