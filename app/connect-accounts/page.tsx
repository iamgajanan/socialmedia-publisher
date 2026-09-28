import Link from "next/link";
import { ArrowRight, Link2, LockKeyhole, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getProviderConfig } from "@/lib/social/oauth";
import { AccountsManager, type AccountRow } from "@/components/connect-accounts/accounts-manager";

export const instant = false;

const providers = [
  ["facebook", "Facebook", "Pages and business publishing destinations."],
  ["instagram", "Instagram", "Professional accounts and visual publishing."],
  ["threads", "Threads", "Threads profiles and text publishing."],
  ["linkedin", "LinkedIn", "Professional profiles and supported pages."],
  ["x", "X", "Posts, replies, and future publishing."],
  ["youtube", "YouTube", "Channels and video publishing."],
  ["tiktok", "TikTok", "Profile and video publishing."],
] as const;

const errors: Record<string, string> = {
  state: "The OAuth security check failed. Please start the connection again.",
  denied: "The provider authorization was cancelled or denied.",
  token: "The provider did not return a usable access token.",
  profile: "The provider account profile could not be loaded.",
  save: "The account could not be saved securely.",
  disconnect: "The account could not be disconnected.",
  refresh: "The token could not be refreshed. Reconnect the account if the provider grant has expired.",
  unsupported: "That social platform is not supported.",
  setup: "This provider is not configured on the server yet.",
};

export default async function ConnectAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const platform = typeof params.platform === "string" ? params.platform : null;
  const connected = params.connected === "1";
  const disconnected = params.disconnected === "1";

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);

  const { data } = await supabase.from("socialmedia_social_accounts")
    .select("id, platform, account_name, username, avatar_url, status, token_expires_at, provider_account_url")
    .eq("profile_id", userId).order("created_at", { ascending: false });
  const accounts = (data ?? []) as AccountRow[];
  const accountsByPlatform = new Map<string, AccountRow[]>();
  for (const account of accounts) {
    const existing = accountsByPlatform.get(account.platform) ?? [];
    existing.push(account);
    accountsByPlatform.set(account.platform, existing);
  }
  const connectedCount = accounts.filter((account) => account.status === "connected").length;

  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-muted/70 p-6 shadow-sm sm:p-8">
      <div className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="rounded-full px-3 py-1"><Link2 className="mr-1.5 size-3.5" />Distribution</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Connect your social accounts</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Bring your publishing destinations into one workspace. OAuth credentials and provider tokens stay on the server and are never sent to the browser.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
          <Button asChild><Link href="/create-post"><ArrowRight />Create post</Link></Button>
        </div>
      </div>
    </section>

    {(connected || disconnected || error) && <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5"}`}>
      {error ? `${errors[error] ?? "Something went wrong."}${platform ? ` Platform: ${platform}.` : ""}` : connected ? "Account connected successfully." : "Account disconnected successfully."}
    </div>}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {providers.map(([id, name, description]) => {
        const configured = Boolean(getProviderConfig(id));
        const platformAccounts = accountsByPlatform.get(id) ?? [];
        const account = platformAccounts[0];
        const isConnected = account?.status === "connected";
        const mark = name === "Instagram" ? "◎" : name === "Threads" ? "@" : name === "LinkedIn" ? "in" : name === "YouTube" ? "▶" : name === "TikTok" ? "♪" : name === "X" ? "𝕏" : "f";
        return <Card key={id} className={"overflow-hidden shadow-sm transition " + (isConnected ? "border-primary/30 bg-primary/[0.02]" : "")}><CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-sm font-bold">{mark}</div><Badge variant={isConnected ? "secondary" : "outline"}>{isConnected ? "Connected" : configured ? "Ready" : "Setup required"}</Badge></div>
          <CardTitle className="mt-2">{name}</CardTitle><CardDescription>{description}</CardDescription>
        </CardHeader><CardContent>{account ? <div className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold">{mark}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{account.account_name}</p><p className="truncate text-xs text-muted-foreground">{account.username ? "@" + account.username : name + " account"}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={isConnected ? "secondary" : "destructive"}>{isConnected ? "Connected" : "Needs attention"}</Badge>{platformAccounts.length > 1 && <Badge variant="outline">+{platformAccounts.length - 1} more</Badge>}</div>
          <div className="flex flex-wrap gap-2">{isConnected ? <Button asChild className="flex-1" size="sm"><Link href="/create-post"><ArrowRight />Create post</Link></Button> : configured ? <Button asChild className="flex-1" size="sm"><Link href={`/api/social/oauth/start/${id}`}><Plus />Reconnect {name}</Link></Button> : null}{account.provider_account_url && <Button asChild size="sm" variant="outline"><Link href={account.provider_account_url} target="_blank" rel="noreferrer">View</Link></Button>}</div>
        </div> : configured ? <Button asChild className="w-full"><Link href={"/api/social/oauth/start/" + id}><Plus />Connect {name}</Link></Button> : <Button className="w-full" variant="outline" disabled><LockKeyhole />Configure OAuth first</Button>}</CardContent></Card>;
      })}
    </section>

    <Card className="border-primary/15 bg-primary/[0.03] shadow-sm"><CardContent className="grid gap-5 p-6 sm:grid-cols-3">
      {[["1","Authorize","Approve only the provider permissions this workspace needs."],["2","Protect","Tokens are encrypted with AES-256-GCM before storage."],["3","Publish","Later phases use the same account records for scheduling and publishing."]].map(([number,title,description]) => <div key={number} className="flex gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></div></div>)}
    </CardContent></Card>

    {connectedCount > 0 && <Card className="border-primary/15 bg-primary/[0.03] shadow-sm"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Publishing is ready</p><p className="mt-1 text-sm text-muted-foreground">{connectedCount} connected {connectedCount === 1 ? "destination is" : "destinations are"} available in the composer.</p></div><Button asChild><Link href="/create-post">Create a post <ArrowRight /></Link></Button></CardContent></Card>}
    {accounts.length > 0 && <section className="space-y-4"><div><p className="text-sm font-medium text-muted-foreground">Account management</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Manage connected accounts</h2></div><AccountsManager accounts={accounts} /></section>}
    <p className="text-xs leading-5 text-muted-foreground">Provider applications must be configured with the exact callback URL before authorization can succeed. Provider scopes and app-review requirements vary; the UI intentionally does not claim a provider is live until its server credentials are present.</p>
  </div>;
}
