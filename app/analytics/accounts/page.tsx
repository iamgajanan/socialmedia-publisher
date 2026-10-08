import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsSyncButton } from "@/components/analytics-sync-button";

export const instant = false;

function n(value: unknown) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value ?? 0));
}

export default async function AnalyticsAccountsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");

  const profileId = String(claims.claims.sub);
  const { data: connectedAccounts } = await supabase
    .from("socialmedia_social_accounts")
    .select("id,platform,account_name,username,status,avatar_url,provider_account_url,external_account_id")
    .eq("profile_id", profileId)
    .eq("status", "connected")
    .order("created_at", { ascending: true });

  const uniqueAccounts = [...new Map(
    (connectedAccounts ?? []).map((account) => [
      `${account.platform}:${account.external_account_id}`,
      account,
    ]),
  ).values()];

  const accountIds = uniqueAccounts.map((account) => account.id);
  const { data: snapshots } = accountIds.length
    ? await supabase
      .from("socialmedia_account_analytics")
      .select("id,social_account_id,platform,follower_count,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at")
      .in("social_account_id", accountIds)
      .order("captured_at", { ascending: false })
      .limit(Math.max(100, accountIds.length * 30))
    : { data: [] };

  const latestByAccount = new Map<string, (typeof snapshots extends Array<infer T> ? T : never)>();
  for (const snapshot of snapshots ?? []) {
    if (!latestByAccount.has(snapshot.social_account_id)) latestByAccount.set(snapshot.social_account_id, snapshot);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Account analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">One card per connected account, using its latest provider snapshot.</p>
        </div>
        <AnalyticsSyncButton />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {uniqueAccounts.length ? uniqueAccounts.map((account) => {
          const row = latestByAccount.get(account.id);
          return (
            <Card key={account.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{account.account_name}</CardTitle>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {account.username ? `@${account.username}` : account.platform}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">{account.platform}</Badge>
              </CardHeader>
              <CardContent>
                {row ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">Followers</span>
                        <p className="mt-1 text-xl font-semibold">{row.follower_count == null ? "—" : n(row.follower_count)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">Impressions</span>
                        <p className="mt-1 text-xl font-semibold">{n(row.impressions)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">Reach</span>
                        <p className="mt-1 text-xl font-semibold">{n(row.reach)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">Interactions</span>
                        <p className="mt-1 text-xl font-semibold">
                          {n(Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0) + Number(row.saves ?? 0))}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Latest snapshot · {new Date(row.captured_at).toLocaleString("en-IN")}
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="text-sm font-medium">No analytics snapshot yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Click “Sync analytics” to fetch the latest provider data.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        }) : (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No connected accounts. Connect a social account before syncing analytics.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
