export const API_SOCIAL_PLATFORMS = ["facebook","instagram","threads","linkedin","x","youtube","tiktok"] as const;
export type ApiSocialPlatform = (typeof API_SOCIAL_PLATFORMS)[number];

export type ApiConnectedAccount = {
  id: string;
  platform: ApiSocialPlatform;
  accountName: string;
  externalAccountId: string;
  username: string | null;
  avatarUrl: string | null;
  status: "connected" | "disconnected" | "error";
  providerAccountUrl: string | null;
};

export function parsePlatformFilter(value: string | null): { platforms?: ApiSocialPlatform[]; error?: string } {
  if (!value) return {};
  const requested = [...new Set(value.split(",").map((platform) => platform.trim().toLowerCase()).filter(Boolean))];
  const invalid = requested.find((platform) => !API_SOCIAL_PLATFORMS.includes(platform as ApiSocialPlatform));
  if (invalid) return { error: `Unsupported platform: ${invalid}.` };
  return { platforms: requested as ApiSocialPlatform[] };
}

export function normalizeConnectedAccount(row: {
  id: string; platform: string; account_name: string; external_account_id: string;
  username: string | null; avatar_url: string | null; status: string; provider_account_url: string | null;
}): ApiConnectedAccount | null {
  if (!API_SOCIAL_PLATFORMS.includes(row.platform as ApiSocialPlatform)) return null;
  if (!["connected","disconnected","error"].includes(row.status)) return null;
  return {
    id: row.id, platform: row.platform as ApiSocialPlatform, accountName: row.account_name,
    externalAccountId: row.external_account_id, username: row.username, avatarUrl: row.avatar_url,
    status: row.status as ApiConnectedAccount["status"], providerAccountUrl: row.provider_account_url,
  };
}
