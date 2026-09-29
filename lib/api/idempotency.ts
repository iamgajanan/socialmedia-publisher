import { createHash } from "node:crypto";

export const API_IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const API_JSON_BODY_MAX_BYTES = 1 * 1024 * 1024;

export function normalizeIdempotencyKey(value: string): string {
  return value.trim();
}

export function isValidIdempotencyKey(value: string): boolean {
  return value.length > 0 &&
    value.length <= API_IDEMPOTENCY_KEY_MAX_LENGTH &&
    /^[A-Za-z0-9._~:-]+$/.test(value);
}

export function hashRequestBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
