import { notFound } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ServerCog, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOpsAdmin } from "@/lib/ops/access";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function OpsPage() {
  const user = await requireOpsAdmin();
  if (!user) notFound();

  const admin = createAdminClient();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    signupsResult,
    publishingUsersResult,
    connectedAccountsResult,
    successfulPostsResult,
    failedPostsResult,
    scheduledPostsResult,
    publishingPostsResult,
    failedDestinationsResult,
    oauthFailuresResult,
    tokenRefreshFailuresResult,
    notificationFailuresResult,
    billingFailuresResult,
    workerFailuresResult,
  ] = await Promise.all([
    admin.from("socialmedia_profiles").select("id", { count: "exact", head: true }),
    admin.from("socialmedia_users").select("id", { count: "exact", head: true }),
    admin.from("socialmedia_social_accounts").select("id", { count: "exact", head: true }).eq("status", "connected"),
    admin.from("socialmedia_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("socialmedia_posts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("socialmedia_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    admin.from("socialmedia_posts").select("id", { count: "exact", head: true }).eq("status", "publishing"),
    admin.from("socialmedia_post_platforms").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", dayAgo),
    admin.from("socialmedia_oauth_health_checks").select("id", { count: "exact", head: true }).in("status", ["invalid", "error"]).gte("checked_at", dayAgo),
    admin.from("socialmedia_notification_logs").select("id", { count: "exact", head: true }).eq("event_type", "token_expired").gte("created_at", dayAgo),
    admin.from("socialmedia_notification_logs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", dayAgo),
    admin.from("socialmedia_workspaces").select("id", { count: "exact", head: true }).in("subscription_status", ["past_due", "incomplete"]),
    admin.from("socialmedia_worker_runs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("started_at", dayAgo),
  ]);

  const countOrThrow = (result: { count: number | null; error: { message: string } | null }) => {
    if (result.error) throw new Error(result.error.message);
    return result.count ?? 0;
  };

  const signups = countOrThrow(signupsResult);
  const publishingUsers = countOrThrow(publishingUsersResult);
  const connectedAccounts = countOrThrow(connectedAccountsResult);
  const successfulPosts = countOrThrow(successfulPostsResult);
  const failedPosts = countOrThrow(failedPostsResult);
  const scheduledPosts = countOrThrow(scheduledPostsResult);
  const publishingPosts = countOrThrow(publishingPostsResult);
  const failedDestinations24h = countOrThrow(failedDestinationsResult);
  const oauthFailures24h = countOrThrow(oauthFailuresResult);
  const tokenRefreshFailures24h = countOrThrow(tokenRefreshFailuresResult);
  const notificationFailures24h = countOrThrow(notificationFailuresResult);
  const billingFailures = countOrThrow(billingFailuresResult);
  const workerFailures24h = countOrThrow(workerFailuresResult);

  const [{ data: recentPostActivity }, { data: recentAccountActivity }] = await Promise.all([
    admin.from("socialmedia_posts").select("profile_id").gte("updated_at", monthAgo).limit(10000),
    admin.from("socialmedia_social_accounts").select("profile_id").gte("updated_at", monthAgo).limit(10000),
  ]);
  const activeUsers = new Set([
    ...(recentPostActivity ?? []).map((row) => row.profile_id),
    ...(recentAccountActivity ?? []).map((row) => row.profile_id),
  ]).size;

  const { data: recentFailures } = await admin
    .from("socialmedia_post_platforms")
    .select("id,post_id,social_account_id,error_message,updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(10);

  const accountIds = [...new Set((recentFailures ?? []).map((row) => row.social_account_id).filter(Boolean))];
  const { data: failureAccounts } = accountIds.length
    ? await admin.from("socialmedia_social_accounts").select("id,platform,account_name").in("id", accountIds)
    : { data: [] };
  const accountMap = new Map((failureAccounts ?? []).map((account) => [account.id, account]));

  const { data: workerRuns } = await admin
    .from("socialmedia_worker_runs")
    .select("id,worker_type,status,started_at,finished_at,duration_ms,result,error_message")
    .order("started_at", { ascending: false })
    .limit(12);

  const metricCards = [
    ["Signups", signups, Users],
    ["Active users · 30d", activeUsers, Activity],
    ["Publishing users", publishingUsers, Users],
    ["Connected accounts", connectedAccounts, ServerCog],
    ["Successful posts", successfulPosts, CheckCircle2],
    ["Failed posts", failedPosts, AlertTriangle],
    ["Scheduled posts", scheduledPosts, Clock3],
    ["Publishing now", publishingPosts, RefreshCw],
  ] as const;

  const healthCards = [
    ["Provider failures · 24h", failedDestinations24h],
    ["OAuth failures · 24h", oauthFailures24h],
    ["Token refresh alerts · 24h", tokenRefreshFailures24h],
    ["Notification failures · 24h", notificationFailures24h],
    ["Cron/worker failures · 24h", workerFailures24h],
    ["Billing failures", billingFailures],
  ] as const;

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Badge variant="secondary">Internal</Badge><span className="text-xs text-muted-foreground">{user.email}</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Operations</h1>
            <p className="mt-1 text-sm text-muted-foreground">Production visibility for publishing, OAuth, workers, queues, and billing health.</p>
          </div>
          <Button asChild variant="outline"><a href="/ops"><RefreshCw />Refresh</a></Button>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(([label, value, Icon]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-4 text-muted-foreground" /></div>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader><CardTitle>Operational health</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {healthCards.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                <span className="text-sm">{label}</span>
                <Badge variant={value > 0 ? "destructive" : "secondary"}>{formatNumber(value)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Recent publishing failures</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(recentFailures ?? []).length ? recentFailures?.map((failure) => {
                const account = accountMap.get(failure.social_account_id);
                return <div key={failure.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">{account?.platform ?? "Unknown platform"} · {account?.account_name ?? "Unknown account"}</span><span className="text-muted-foreground">{formatDate(failure.updated_at)}</span></div>
                  <p className="mt-2 text-sm leading-5 text-destructive">{failure.error_message || "Publishing failed without a recorded provider message."}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Post {failure.post_id}</p>
                </div>;
              }) : <p className="text-sm text-muted-foreground">No recent publishing failures.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Worker runs</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(workerRuns ?? []).length ? workerRuns?.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{run.worker_type}</p><p className="text-[11px] text-muted-foreground">{formatDate(run.started_at)}{run.duration_ms != null ? ` · ${run.duration_ms}ms` : ""}</p></div>
                  <Badge variant={run.status === "succeeded" ? "secondary" : run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">No worker runs recorded yet.</p>}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">Observability is internal-only. Provider error messages shown here are operational diagnostics and are not exposed through customer-facing APIs.</p>
      </div>
    </main>
  );
}
