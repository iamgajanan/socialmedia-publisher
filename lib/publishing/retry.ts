const MAX_RETRY_DELAY_SECONDS = 60 * 60;

export function canRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}

export function getRetryDelaySeconds(retryCount: number): number {
  const normalizedCount = Math.max(0, Math.floor(retryCount));
  return Math.min(2 ** normalizedCount * 60, MAX_RETRY_DELAY_SECONDS);
}

export function getNextRetryAt(retryCount: number, now = new Date()): Date {
  return new Date(now.getTime() + getRetryDelaySeconds(retryCount) * 1000);
}

export function getRetrySchedule(retryCount: number, maxRetries: number, now = new Date()) {
  return {
    retryCount,
    maxRetries,
    canRetry: canRetry(retryCount, maxRetries),
    nextRetryAt: canRetry(retryCount, maxRetries) ? getNextRetryAt(retryCount, now).toISOString() : null,
  };
}
