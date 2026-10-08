import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiSocialPlatform } from "./connected-accounts-core";

export type ApiConnectedAccountRow = {
  id: string;
  platform: ApiSocialPlatform;
  account_name: string;
  external_account_id: string;
  username: string | null;
  avatar_url: string | null;
  status: "connected" | "disconnected" | "error";
  provider_account_url: string | null;
};

export async function getApiConnectedAccounts(
  profileId: string,
  platforms?: ApiSocialPlatform[],
): Promise<{ accounts: ApiConnectedAccountRow[]; error: string | null }> {
  const admin = createAdminClient();
  let query = admin
    .from("socialmedia_social_accounts")
    .select("id, platform, account_name, external_account_id, username, avatar_url, status, provider_account_url")
    .eq("profile_id", profileId)
    .eq("status", "connected")
    .order("platform", { ascending: true })
    .order("account_name", { ascending: true });

  if (workspaceId) query = query.eq("workspace_id", workspaceId);\n  if (platforms?.length) query = query.in("platform", platforms);

  const { data, error } = await query;
  if (error) {
    console.error("api_connected_accounts_lookup_failed", {
      profileId,
      code: error.code,
      message: error.message,
    });
    return { accounts: [], error: "Unable to load connected accounts." };
  }

  return { accounts: (data ?? []) as ApiConnectedAccountRow[], error: null };
}
