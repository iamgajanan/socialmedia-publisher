import "server-only";
import { PublisherError } from "./types";

export async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (response.ok) return response;
  const text = await response.text().catch(() => "");
  let message = text;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const nestedError = json.error && typeof json.error === "object" ? json.error as Record<string, unknown> : null;
    message =
      typeof nestedError?.message === "string"
        ? nestedError.message
        : typeof json.error === "string"
          ? json.error
          : typeof json.message === "string"
            ? json.message
            : text;
  } catch {}
  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  throw new PublisherError(message || `Provider request failed (${response.status}).`, { retryable, code: `http_${response.status}` });
}
