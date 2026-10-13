import type { RefreshResult } from "./types";

export type XRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export function normalizeXRefreshResponse(data: XRefreshResponse): RefreshResult | null {
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    ...(typeof data.expires_in === "number" ? { expiresIn: data.expires_in } : {}),
    ...(typeof data.refresh_token === "string" && data.refresh_token.length > 0
      ? { refreshToken: data.refresh_token }
      : {}),
  };
}
