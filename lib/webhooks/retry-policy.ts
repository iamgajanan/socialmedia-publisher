export function isRetryableWebhookStatus(status: number): boolean {
  // Do not waste retries on redirects or permanent client errors. 408 and 429
  // are transient by definition; 5xx responses may recover after backoff.
  return status === 408 || status === 429 || status >= 500;
}
