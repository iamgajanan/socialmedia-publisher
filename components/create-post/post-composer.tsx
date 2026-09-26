"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, ChevronDown, Facebook, Instagram, Linkedin, Loader2, Send, Sparkles, Youtube } from "lucide-react";

import { saveDraft, type SaveDraftState } from "@/app/create-post/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaUploader, type UploadedMedia } from "@/components/create-post/media-uploader";
import { cn } from "@/lib/utils";
import { formatTimeZoneName } from "@/lib/scheduling/timezone";

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

export function PostComposer({ accounts, timezone = "Asia/Kolkata", initialPost }: { accounts: Account[]; timezone?: string; initialPost?: { id: string; content: string; accountIds: string[]; mediaPaths: string[]; mode: "draft" | "schedule"; scheduledAt: string | null } }) {
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [selected, setSelected] = useState<string[]>(initialPost?.accountIds ?? accounts.map((account) => account.id));
  const [media, setMedia] = useState<UploadedMedia[]>(initialPost?.mediaPaths.map((path) => ({ path, name: path.split("/").pop() ?? path, size: 0, type: "" })) ?? []);
  const [mode, setMode] = useState<"draft" | "schedule">(initialPost?.mode ?? "draft");
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() => { if (!initialPost?.scheduledAt) return ""; const parts = new Intl.DateTimeFormat("sv-SE",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(initialPost.scheduledAt)); const map=Object.fromEntries(parts.filter((part)=>part.type!=="literal").map((part)=>[part.type,part.value])); return map.year ? `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}` : ""; });
  const [state, formAction, pending] = useActionState(saveDraft, initialState);
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(accounts[0]?.platform ?? null);

  const selectedAccounts = accounts.filter((account) => selected.includes(account.id));
  const selectedPlatforms = useMemo(() => [...new Set(selectedAccounts.map((account) => account.platform))], [selectedAccounts]);
  const previewAccount = selectedAccounts.find((account) => account.platform === previewPlatform) ?? selectedAccounts[0];
  const selectedMeta = previewPlatform ? meta[previewPlatform] : null;
  const overLimit = selectedMeta ? content.length > selectedMeta.limit : false;
  const canSave = content.trim().length > 0 && selected.length > 0 && !overLimit && (mode === "draft" || Boolean(scheduledAtLocal));

  const limits = useMemo(
    () => selectedPlatforms.map((platform) => ({ platform, ...meta[platform], over: content.length > meta[platform].limit })),
    [selectedPlatforms, content.length],
  );

  function toggleAccount(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <form action={formAction} className="space-y-6">
    {selected.map((id) => <input key={id} type="hidden" name="accountIds" value={id} />)}
    {media.map((item) => <input key={item.path} type="hidden" name="mediaPaths" value={item.path} />)}
    {initialPost?.id && <input type="hidden" name="postId" value={initialPost.id} />}<input type="hidden" name="content" value={content} />
    <input type="hidden" name="mode" value={mode} />
    <input type="hidden" name="scheduledAtLocal" value={scheduledAtLocal} />
    <input type="hidden" name="timezone" value={timezone} />

    <div className="grid min-w-0 gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Post content</CardTitle><CardDescription>Write once, select destinations, and prepare a draft or scheduled post.</CardDescription></div>
            <Badge variant={selected.length ? "secondary" : "outline"}>{selected.length} account{selected.length === 1 ? "" : "s"} selected</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <textarea spellCheck value={content} onChange={(event) => setContent(event.target.value)} placeholder="What do you want to share?" aria-label="Post content" className="min-h-[280px] w-full resize-y rounded-2xl border bg-background p-4 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{content.length.toLocaleString()} characters</span>
            {selectedMeta && <span className={cn(overLimit && "font-medium text-destructive")}>{content.length.toLocaleString()} / {selectedMeta.limit.toLocaleString()} for {selectedMeta.name}</span>}
          </div>

          <MediaUploader uploaded={media} onUploaded={setMedia} />

          <div className="mt-5 rounded-2xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Publishing mode</p>
                <p className="text-xs leading-5 text-muted-foreground">Choose whether to keep this post as a draft or schedule it for later.</p>
              </div>
              <div className="grid grid-cols-2 rounded-xl border bg-background p-1 text-xs">
                <button type="button" onClick={() => setMode("draft")} className={cn("rounded-lg px-3 py-2 font-medium transition", mode === "draft" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Save draft</button>
                <button type="button" onClick={() => setMode("schedule")} className={cn("rounded-lg px-3 py-2 font-medium transition", mode === "schedule" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Schedule</button>
              </div>
            </div>
            {mode === "schedule" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="space-y-2">
                  <span className="text-xs font-medium">Date and time</span>
                  <input type="datetime-local" value={scheduledAtLocal} onChange={(event) => setScheduledAtLocal(event.target.value)} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} required aria-label="Scheduled date and time" className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </label>
                <div className="rounded-xl border bg-background px-3 py-2 text-xs">
                  <p className="font-medium">Workspace timezone</p>
                  <p className="mt-1 text-muted-foreground">{timezone}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">{formatTimeZoneName(timezone)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
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
            <Button type="submit" disabled={!canSave || pending}>{pending ? <Loader2 className="animate-spin" /> : <Check />}{pending ? (mode === "schedule" ? "Scheduling…" : "Saving…") : (mode === "schedule" ? "Schedule post" : "Save draft")}</Button>
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
