"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, ChevronDown, Facebook, ImagePlus, Instagram, Linkedin, Loader2, Send, Sparkles, Youtube } from "lucide-react";

import { saveDraft, type SaveDraftState } from "@/app/create-post/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Account = { id: string; platform: string; account_name: string; username: string | null; avatar_url: string | null };
const meta: Record<string, { name: string; icon: typeof Facebook; limit: number }> = {
  facebook: { name: "Facebook", icon: Facebook, limit: 63206 },
  instagram: { name: "Instagram", icon: Instagram, limit: 2200 },
  linkedin: { name: "LinkedIn", icon: Linkedin, limit: 3000 },
  x: { name: "X", icon: Send, limit: 280 },
  youtube: { name: "YouTube", icon: Youtube, limit: 5000 },
  tiktok: { name: "TikTok", icon: Send, limit: 2200 },
};

const initialState: SaveDraftState = { ok: false, message: "" };

export function PostComposer({ accounts }: { accounts: Account[] }) {
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>(accounts.map((account) => account.id));
  const [state, formAction, pending] = useActionState(saveDraft, initialState);
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(accounts[0]?.platform ?? null);

  const selectedAccounts = accounts.filter((account) => selected.includes(account.id));
  const selectedPlatforms = [...new Set(selectedAccounts.map((account) => account.platform))];
  const previewAccount = selectedAccounts.find((account) => account.platform === previewPlatform) ?? selectedAccounts[0];
  const selectedMeta = previewPlatform ? meta[previewPlatform] : null;
  const overLimit = selectedMeta ? content.length > selectedMeta.limit : false;
  const canSave = content.trim().length > 0 && selected.length > 0 && !overLimit;

  const limits = useMemo(
    () => selectedPlatforms.map((platform) => ({ platform, ...meta[platform], over: content.length > meta[platform].limit })),
    [selectedPlatforms, content.length],
  );

  function toggleAccount(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <form action={formAction} className="space-y-6">
    {selected.map((id) => <input key={id} type="hidden" name="accountIds" value={id} />)}
    <input type="hidden" name="content" value={content} />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Post content</CardTitle><CardDescription>Write once, select destinations, and validate before saving.</CardDescription></div>
            <Badge variant={selected.length ? "secondary" : "outline"}>{selected.length} account{selected.length === 1 ? "" : "s"} selected</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What do you want to share?" aria-label="Post content" className="min-h-[280px] w-full resize-y rounded-2xl border bg-background p-4 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{content.length.toLocaleString()} characters</span>
            {selectedMeta && <span className={cn(overLimit && "font-medium text-destructive")}>{content.length.toLocaleString()} / {selectedMeta.limit.toLocaleString()} for {selectedMeta.name}</span>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled><ImagePlus />Add media <span className="text-xs text-muted-foreground">Phase 7</span></Button>
            <Button type="button" variant="outline" disabled><Sparkles />AI assist</Button>
          </div>

          <div className="mt-6 rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Destinations</p><p className="text-xs text-muted-foreground">Choose one or more connected accounts.</p></div><Badge variant="outline">{selectedPlatforms.length} platform{selectedPlatforms.length === 1 ? "" : "s"}</Badge></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {accounts.map((account) => {
                const platform = meta[account.platform];
                const Icon = platform?.icon ?? Send;
                const active = selected.includes(account.id);
                return <button key={account.id} type="button" onClick={() => toggleAccount(account.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-primary bg-primary/5 shadow-sm" : "bg-background hover:bg-muted/60")}>
                  <span className={cn("flex size-9 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted")}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{account.account_name}</span><span className="block truncate text-xs text-muted-foreground">{platform?.name ?? account.platform}{account.username ? ` · @${account.username}` : ""}</span></span>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border", active && "border-primary bg-primary text-primary-foreground")}>{active && <Check className="size-3" />}</span>
                </button>;
              })}
            </div>
          </div>

          {state.message && <div className={cn("mt-4 rounded-xl border px-4 py-3 text-sm", state.ok ? "border-primary/20 bg-primary/5" : "border-destructive/30 bg-destructive/5 text-destructive")}>{state.message}</div>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled><ChevronDown />More actions</Button>
            <Button type="submit" disabled={!canSave || pending}>{pending ? <Loader2 className="animate-spin" /> : <Check />}{pending ? "Saving…" : "Save draft"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit overflow-hidden shadow-sm xl:sticky xl:top-24">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle>Preview</CardTitle><CardDescription>Text preview for the selected destination.</CardDescription></div>
            {selectedPlatforms.length > 1 && <select aria-label="Preview platform" value={previewPlatform ?? ""} onChange={(event) => setPreviewPlatform(event.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs">{selectedPlatforms.map((platform) => <option key={platform} value={platform}>{meta[platform]?.name ?? platform}</option>)}</select>}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {previewAccount ? <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
            <div className="flex items-center gap-3 border-b p-4"><div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">{previewAccount.account_name.slice(0,2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{previewAccount.account_name}</p><p className="truncate text-xs text-muted-foreground">{meta[previewAccount.platform]?.name ?? previewAccount.platform}{previewAccount.username ? ` · @${previewAccount.username}` : ""}</p></div></div>
            <div className="min-h-44 whitespace-pre-wrap p-4 text-sm leading-6">{content || <span className="text-muted-foreground">Your post preview will appear here.</span>}</div>
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">{selectedMeta?.name ?? "Social"} preview · text only</div>
          </div> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a connected account to preview the post.</div>}

          {limits.length > 0 && <div className="mt-4 space-y-2">{limits.map((item) => <div key={item.platform} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs"><span>{item.name}</span><span className={cn(item.over && "font-semibold text-destructive")}>{content.length.toLocaleString()} / {item.limit.toLocaleString()}</span></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  </form>;
}
