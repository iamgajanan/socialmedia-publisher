"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Variant = { id: string; platform: string; variation: number; title: string | null; caption: string; hashtags: string[]; cta: string | null; approval_status: string; character_count: number; character_limit: number };
type Approval = { id: string; master_content: string; requested_platforms: string[]; model: string; status: string; requires_approval: boolean; approved_at: string | null; created_at: string; variants: Variant[] };

export function ApprovalQueue() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/ai/approvals", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load approvals."); setItems(data.approvals ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load approvals."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function resolve(generationId: string, action: "approve" | "reject") {
    setBusy(`${generationId}:${action}`); setError("");
    try { const response = await fetch("/api/ai/approvals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generation_id: generationId, action }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update approval."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update approval."); }
    finally { setBusy(null); }
  }

  if (loading) return <Card><CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading approval queue...</CardContent></Card>;
  return <div className="space-y-4">
    {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    {!items.length ? <Card><CardContent className="py-16 text-center"><p className="font-medium">No pending approvals</p><p className="mt-1 text-sm text-muted-foreground">Generate content with Approval enabled to send it here.</p></CardContent></Card> : items.map((item) => <Card key={item.id}><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">{item.master_content}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{item.requested_platforms.join(", ")} · {item.model}</p></div><Badge variant={item.status === "pending" ? "secondary" : "outline"}>{item.status}</Badge></div></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">{item.variants.map((variant) => <div key={variant.id} className="rounded-xl border p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold capitalize">{variant.platform} · V{variant.variation}</p><Badge variant="outline">{variant.approval_status}</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm">{variant.caption}</p>{variant.hashtags?.length ? <p className="mt-3 text-sm text-primary">{variant.hashtags.join(" ")}</p> : null}{variant.cta ? <p className="mt-3 text-sm font-medium">{variant.cta}</p> : null}<p className="mt-3 text-xs text-muted-foreground">{variant.character_count}/{variant.character_limit} characters</p></div>)}</div>
      {item.status === "pending" ? <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => resolve(item.id, "reject")} disabled={!!busy}>{busy === `${item.id}:reject` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Reject</Button><Button onClick={() => resolve(item.id, "approve")} disabled={!!busy}>{busy === `${item.id}:approve` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Approve</Button></div> : null}
    </CardContent></Card>)}
  </div>;
}
