"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectAccount } from "@/app/connect-accounts/actions";

export type AccountRow = {
  id: string;
  platform: string;
  account_name: string;
  username: string | null;
  avatar_url: string | null;
  status: "connected" | "disconnected" | "error";
  token_expires_at: string | null;
  provider_account_url: string | null;
};

const labels: Record<string, { name: string; description: string; mark: string }> = {
  facebook: { name: "Facebook", description: "Facebook pages and publishing destinations.", mark: "f" },
  instagram: { name: "Instagram", description: "Professional Instagram accounts.", mark: "◎" },
  linkedin: { name: "LinkedIn", description: "Profiles and supported company pages.", mark: "in" },
  x: { name: "X", description: "Posts and publishing access.", mark: "𝕏" },
  youtube: { name: "YouTube", description: "Channels and video publishing.", mark: "▶" },
  tiktok: { name: "TikTok", description: "TikTok profile and video publishing.", mark: "♪" },
};

export function AccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {accounts.map((account) => {
        const meta = labels[account.platform] ?? { name: account.platform, description: "Connected social account.", mark: "•" };
        const expiring = account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now() + 7 * 86400000;
        return (
          <div key={account.id} className="group flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:border-foreground/15 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-sm font-bold">{meta.mark}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{account.account_name}</p>
                  <Badge variant={account.status === "connected" ? "secondary" : "destructive"}>{account.status === "connected" ? "Connected" : "Needs attention"}</Badge>
                  {expiring && <Badge variant="outline">Token expiring</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{meta.name}{account.username ? ` · @${account.username}` : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {account.provider_account_url && <Button asChild size="sm" variant="ghost"><Link href={account.provider_account_url} target="_blank" rel="noreferrer"><ExternalLink />View</Link></Button>}
              <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => disconnectAccount(account.id))}><Unplug />Disconnect</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
