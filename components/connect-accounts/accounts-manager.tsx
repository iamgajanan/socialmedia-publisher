"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Building2, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectAccount, refreshAccount } from "@/app/connect-accounts/actions";

export type AccountRow = { id: string; platform: string; account_name: string; username: string | null; avatar_url: string | null; status: "connected" | "disconnected" | "error"; token_expires_at: string | null; provider_account_url: string | null; socialmedia_user_id?: string | null };

const labels: Record<string, { name: string; mark: string }> = {
  facebook: { name: "Facebook", mark: "f" }, instagram: { name: "Instagram", mark: "◎" }, threads: { name: "Threads", mark: "@" }, linkedin: { name: "LinkedIn", mark: "in" },
  x: { name: "X", mark: "𝕏" }, youtube: { name: "YouTube", mark: "▶" }, tiktok: { name: "TikTok", mark: "♪" },
};

export function AccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [pending, startTransition] = useTransition();
  const linkedinAccount = accounts.find((account) => account.platform === "linkedin" && account.status === "connected");
  return <div className="space-y-4">
    {linkedinAccount?.socialmedia_user_id && <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" />LinkedIn Company Pages</p><p className="mt-1 text-xs text-muted-foreground">Discover the Company Pages managed by this LinkedIn member and add them as publishing destinations.</p></div><Button asChild size="sm" variant="outline"><Link href={`/api/social/linkedin/organizations?user=${encodeURIComponent(linkedinAccount.socialmedia_user_id)}`}><Building2 />Connect Company Pages</Link></Button></div>}
    {accounts.map((account) => {
      const meta = labels[account.platform] ?? { name: account.platform, mark: "•" };
      const expiring = account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now() + 7 * 86400000;
      return <div key={account.id} className="group flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-foreground/15 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-sm font-bold">{meta.mark}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{account.account_name}</p><Badge variant={account.status === "connected" ? "secondary" : "destructive"}>{account.status === "connected" ? "Connected" : "Needs attention"}</Badge>{account.platform === "linkedin" && account.username && <Badge variant="outline">{account.username.includes("linkedin") ? "Personal" : "Company Page"}</Badge>}{expiring && <Badge variant="outline">Token expiring</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{meta.name}{account.username ? ` · @${account.username}` : ""}</p></div></div>
        <div className="flex flex-wrap items-center gap-2">{account.provider_account_url && <Button asChild size="sm" variant="ghost"><Link href={account.provider_account_url} target="_blank" rel="noreferrer"><ExternalLink />View</Link></Button>}{expiring && <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => refreshAccount(account.id))}><RefreshCw />Refresh</Button>}<Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => disconnectAccount(account.id))}><Unplug />Disconnect</Button></div>
      </div>;
    })}
  </div>;
}
