"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const platforms = ["instagram", "linkedin", "x", "facebook", "threads", "tiktok", "youtube"] as const;
type Variant = { id?: string; platform: string; variation: number; title: string | null; caption: string; hashtags: string[]; cta: string | null; media_recommendations: string[]; validation: { character_count: number; character_limit: number; within_limit: boolean; warnings: string[] }; approval_status?: string };

export function AiContentStudio() {
  const [masterContent, setMasterContent] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState<string[]>(["instagram", "linkedin", "x"]);
  const [variations, setVariations] = useState(1);
  const [approval, setApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; master_content: string; requested_platforms: string[]; model: string; status: string; created_at: string }>>([]);

  const selectedLabel = useMemo(() => selected.length ? selected.join(", ") : "Select platforms", [selected]);
  async function loadHistory() { const response = await fetch("/api/ai/content", { cache: "no-store" }); const data = await response.json(); if (response.ok) setHistory(data.generations ?? []); }
  useEffect(() => { void loadHistory(); }, []);

  function toggle(platform: string) { setSelected((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]); }
  async function generate() {
    setError(""); setVariants([]);
    if (!masterContent.trim() || !selected.length) { setError("Add master content and select at least one platform."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/ai/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ master_content: masterContent, brand_voice: brandVoice, instructions, platforms: selected, variations, require_approval: approval }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      setVariants(data.variants ?? []); void loadHistory();
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Generation failed."); }
    finally { setLoading(false); }
  }
  async function copy(value: string, id: string) { await navigator.clipboard.writeText(value); setCopied(id); window.setTimeout(() => setCopied(null), 1500); }

  return <div className="space-y-6">
    <Card className="overflow-hidden border-primary/10"><CardHeader className="bg-accent/30"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></span><div><CardTitle>Platform-aware content engine</CardTitle><p className="mt-1 text-sm text-muted-foreground">Turn one master message into native versions for every destination.</p></div></div></CardHeader><CardContent className="space-y-5 p-5">
      <div><label className="mb-2 block text-sm font-medium">Master content</label><Textarea value={masterContent} onChange={(event) => setMasterContent(event.target.value)} maxLength={10000} placeholder="Paste the campaign idea, product message, announcement, or source content..." className="min-h-32" /><p className="mt-1 text-right text-xs text-muted-foreground">{masterContent.length}/10,000</p></div>
      <div className="grid gap-4 lg:grid-cols-2"><div><label className="mb-2 block text-sm font-medium">Brand voice</label><Input value={brandVoice} onChange={(event) => setBrandVoice(event.target.value)} placeholder="e.g. warm, premium, witty, expert" /></div><div><label className="mb-2 block text-sm font-medium">Extra instructions</label><Input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Facts, CTA, audience, words to avoid..." /></div></div>
      <div><label className="mb-2 block text-sm font-medium">Destinations</label><div className="flex flex-wrap gap-2">{platforms.map((platform) => <label key={platform} className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"><Checkbox checked={selected.includes(platform)} onCheckedChange={() => toggle(platform)} /><span className="capitalize">{platform}</span></label>)}</div><p className="mt-2 text-xs text-muted-foreground">{selectedLabel}</p></div>
      <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Variations & approval</p><p className="text-xs text-muted-foreground">Generate up to 3 variants per platform and optionally require human approval.</p></div><div className="flex items-center gap-3"><select value={variations} onChange={(event) => setVariations(Number(event.target.value))} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value={1}>1 variation</option><option value={2}>2 variations</option><option value={3}>3 variations</option></select><label className="flex items-center gap-2 text-sm"><Checkbox checked={approval} onCheckedChange={(value) => setApproval(Boolean(value))} />Approval</label></div></div>
      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <Button onClick={generate} disabled={loading || !masterContent.trim() || !selected.length} className="w-full sm:w-auto">{loading ? <><Loader2 className="size-4 animate-spin" />Generating...</> : <><Sparkles className="size-4" />Generate platform versions</>}</Button>
    </CardContent></Card>

    {variants.length ? <div className="grid gap-4 lg:grid-cols-2">{variants.map((variant) => <Card key={`${variant.platform}-${variant.variation}`}><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base capitalize">{variant.platform} · V{variant.variation}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{variant.validation.character_count}/{variant.validation.character_limit} characters</p></div><Badge variant={variant.validation.within_limit ? "secondary" : "destructive"}>{variant.validation.within_limit ? "Valid" : "Over limit"}</Badge></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border bg-background p-4 text-sm whitespace-pre-wrap">{variant.title ? <p className="mb-3 font-semibold">{variant.title}</p> : null}{variant.caption}<div className="mt-3 text-primary">{variant.hashtags.join(" ")}</div>{variant.cta ? <p className="mt-3 font-medium">{variant.cta}</p> : null}</div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => copy(`${variant.title ? `${variant.title}\n\n` : ""}${variant.caption}${variant.hashtags.length ? `\n\n${variant.hashtags.join(" ")}` : ""}${variant.cta ? `\n\n${variant.cta}` : ""}`, `${variant.platform}-${variant.variation}`)}>{copied === `${variant.platform}-${variant.variation}` ? <><Check className="size-4" />Copied</> : <><Copy className="size-4" />Copy</>}</Button></div><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media recommendations</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{variant.media_recommendations.map((item) => <li key={item}>{item}</li>)}</ul></div></CardContent></Card>)}</div> : null}

    <Card><CardHeader><CardTitle className="text-base">Recent generations</CardTitle></CardHeader><CardContent>{history.length ? <div className="space-y-2">{history.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.master_content}</p><p className="mt-1 text-xs text-muted-foreground">{item.requested_platforms.join(", ")} · {item.model}</p></div><Badge variant="outline">{item.status}</Badge></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No generations yet.</p>}</CardContent></Card>
  </div>;
}
