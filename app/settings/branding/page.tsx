"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Building2, Globe2, Image as ImageIcon, Palette, Save, Sparkles } from "lucide-react";

import { updateBranding, type BrandingState } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { useEffect } from "react";
import { getCurrentWorkspace } from "@/lib/workspace/server";

const initialState: BrandingState = { ok: false, message: "" };

export default function BrandingPage() {
  const [state, formAction, pending] = useActionState(updateBranding, initialState);
  const { toast } = useToast();
  useEffect(() => {
    if (state.message) toast({ title: state.ok ? "Branding updated" : "Branding update failed", message: state.message, variant: state.ok ? "success" : "error" });
  }, [state, toast]);

  const [context, setContext] = useStatePromise();
  return <BrandingContent context={context} state={state} formAction={formAction} pending={pending} />;
}

function useStatePromise() {
  const [context, setContext] = require("react").useState<Awaited<ReturnType<typeof getCurrentWorkspace>> | null>(null);
  require("react").useEffect(() => { void getCurrentWorkspace().then(setContext); }, []);
  return [context, setContext] as const;
}

function BrandingContent({ context, state, formAction, pending }: { context: Awaited<ReturnType<typeof getCurrentWorkspace>> | null; state: BrandingState; formAction: (payload: FormData) => void; pending: boolean }) {
  if (!context) return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading branding settings…</div>;
  return <div className="space-y-8">
    <div className="max-w-3xl"><Badge variant="secondary" className="rounded-full px-3 py-1"><Palette className="mr-1.5 size-3.5" />White-label</Badge><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make the workspace yours.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Set the name, logo, colours, and future custom-domain identity shown across the workspace.</p></div>
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Workspace identity</CardTitle><CardDescription>These settings are scoped to the current workspace.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="space-y-2"><Label htmlFor="brandName">Brand name</Label><Input id="brandName" name="brandName" defaultValue={context.workspace.name} maxLength={80} required /></div>
        <div className="space-y-2"><Label htmlFor="logoUrl">Logo URL</Label><div className="flex gap-2"><Input id="logoUrl" name="logoUrl" type="url" defaultValue={context.workspace.logo_url ?? ""} placeholder="https://..." /><ImageIcon className="mt-2 size-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Use a public HTTPS image URL. File upload can be added without changing the branding contract.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="primaryColor">Primary colour</Label><div className="flex items-center gap-2"><input id="primaryColor" name="primaryColor" type="color" defaultValue={context.workspace.primary_color} className="size-10 rounded-lg border bg-background p-1" /><Input aria-label="Primary colour hex" defaultValue={context.workspace.primary_color} name="primaryColor" /></div></div><div className="space-y-2"><Label htmlFor="accentColor">Accent colour</Label><div className="flex items-center gap-2"><input id="accentColor" name="accentColor" type="color" defaultValue={context.workspace.accent_color} className="size-10 rounded-lg border bg-background p-1" /><Input aria-label="Accent colour hex" defaultValue={context.workspace.accent_color} name="accentColor" /></div></div></div>
        <div className="space-y-2"><Label htmlFor="customDomain">Custom domain</Label><div className="flex gap-2"><Input id="customDomain" name="customDomain" defaultValue={context.workspace.custom_domain ?? ""} placeholder="social.example.com" /><Globe2 className="mt-2 size-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Reserved now for domain verification and routing. Saving the hostname does not claim the domain.</p></div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : <><Save />Save branding</>}</Button>
      </CardContent></Card>
      <Card className="h-fit overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm"><CardHeader><CardTitle>Live identity preview</CardTitle><CardDescription>Matches the existing OmniSocial card and navigation language.</CardDescription></CardHeader><CardContent><div className="rounded-2xl border bg-background p-5"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: context.workspace.primary_color }}><Sparkles className="size-4" /></span><div><p className="font-semibold">{context.workspace.name}</p><p className="text-xs text-muted-foreground">Publishing workspace</p></div></div><div className="mt-5 rounded-xl border p-4"><div className="h-2 rounded-full" style={{ backgroundColor: context.workspace.accent_color }} /><p className="mt-3 text-sm font-medium">Custom workspace branding</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Brand identity is isolated per workspace.</p></div></div></CardContent></Card>
    </form>
    <p className="text-sm text-muted-foreground"><Link href="/settings" className="text-primary hover:underline">Back to Settings</Link></p>
  </div>;
}
