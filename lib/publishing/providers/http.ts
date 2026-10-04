import "server-only";
import { PublisherError } from "./types";

const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRY_AFTER_SECONDS = 60 * 60;

function parseRetryAfter(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_SECONDS);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, Math.ceil((date - Date.now()) / 1000)), MAX_RETRY_AFTER_SECONDS);
}

export async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
  const response = await fetch(url, { ...init, signal: init.signal ?? timeout, cache: "no-store" }).catch((error) => {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new PublisherError("The provider request timed out; retry later.", { retryable: true, code: "provider_timeout" });
    }
    throw error;
  });
  if (response.ok) return response;

  const retryAfterSeconds = parseRetryAfter(response);
  const text = await response.text().catch(() => "");
  let message = text;
  let nestedError: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    nestedError = json.error && typeof json.error === "object" ? json.error as Record<string, unknown> : null;
    message =
      typeof nestedError?.message === "string"
        ? nestedError.message
        : typeof json.error === "string"
          ? json.error
          : typeof json.message === "string"
            ? json.message
            : text;
  } catch {}
  const providerCode = typeof nestedError?.code === "number" ? nestedError.code : undefined;
  const providerSubcode = typeof nestedError?.error_subcode === "number" ? nestedError.error_subcode : undefined;
  const retryable =
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500 ||
    (providerCode === 9007 && providerSubcode === 2207027) ||
    (providerCode === 24 && providerSubcode === 2207008);

  throw new PublisherError(message || `Provider request failed (${response.status}).`, {
    retryable,
    code: `http_${response.status}`,
    retryAfterSeconds,
  });
}
