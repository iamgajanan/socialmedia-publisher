import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { normalizeConnectedAccount, parsePlatformFilter } from "@/lib/api/connected-accounts-core";

export async function GET(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) return NextResponse.json({ error: authentication.error }, { status: authentication.status });

  const url = new URL(request.url);
  const filter = parsePlatformFilter(url.searchParams.get("platforms"));
  if (filter.error) return NextResponse.json({ error: filter.error }, { status: 400 });

  const admin = createAdminClient();
  let query = admin.from("socialmedia_social_accounts")
    .select("id, platform, account_name, external_account_id, username, avatar_url, status, provider_account_url")
    .eq("profile_id", authentication.profileId)
    .order("platform", { ascending: true })
    .order("account_name", { ascending: true });

  if (filter.platforms?.length) query = query.in("platform", filter.platforms);

  const { data, error } = await query;
  if (error) {
    console.error("api_connected_accounts_lookup_failed", { profileId: authentication.profileId, code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to load connected accounts." }, { status: 500 });
  }

  const accounts = (data ?? []).map(normalizeConnectedAccount).filter((account): account is NonNullable<typeof account> => account !== null);
  return NextResponse.json({ accounts, count: accounts.length });
}
