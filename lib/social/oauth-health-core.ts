export type OAuthHealthStatus = "healthy" | "expiring" | "invalid" | "error";

export type FacebookOAuthHealthResult = {
  status: OAuthHealthStatus;
  httpStatus: number | null;
  tokenExpiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function isExpiring(tokenExpiresAt: string | null, now = Date.now()) {
  if (!tokenExpiresAt) return false;
  const expiresAt = Date.parse(tokenExpiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= now + 7 * 24 * 60 * 60 * 1000;
}

export function classifyFacebookHealth(responseStatus: number, tokenExpiresAt: string | null, now = Date.now(), errorCode: string | null = null, errorMessage: string | null = null): FacebookOAuthHealthResult {
  if (responseStatus >= 200 && responseStatus < 300) {
    return { status: isExpiring(tokenExpiresAt, now) ? "expiring" : "healthy", httpStatus: responseStatus, tokenExpiresAt, errorCode: null, errorMessage: null };
  }
  return { status: responseStatus === 401 || responseStatus === 403 ? "invalid" : "error", httpStatus: responseStatus, tokenExpiresAt, errorCode, errorMessage };
}

export function buildFacebookHealthRequest(graphVersion: string, pageId: string) {
  const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}`);
  endpoint.searchParams.set("fields", "id,name");
  return endpoint;
}
