"use client";

import { useActionState, useEffect } from "react";
import { Building2, Globe2, Image as ImageIcon, Palette, Save, Sparkles } from "lucide-react";

import { updateBranding, type BrandingState } from "@/app/settings/branding/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

type BrandingValues = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
};

const initialState: BrandingState = { ok: false, message: "" };

export function BrandingForm({ values }: { values: BrandingValues }) {
  const [state, formAction, pending] = useActionState(updateBranding, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) toast({ title: state.ok ? "Branding updated" : "Branding update failed", message: state.message, variant: state.ok ? "success" : "error" });
  }, [state, toast]);

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Workspace identity</CardTitle><CardDescription>These settings are scoped to the current workspace.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2"><Label htmlFor="brandName">Brand name</Label><Input id="brandName" name="brandName" defaultValue={values.name} maxLength={80} required /></div>
          <div className="space-y-2"><Label htmlFor="logoUrl">Logo URL</Label><div className="flex gap-2"><Input id="logoUrl" name="logoUrl" type="url" defaultValue={values.logoUrl ?? ""} placeholder="https://..." /><ImageIcon className="mt-2 size-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Use a public HTTPS image URL. File upload can be added later without changing the branding contract.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="primaryColor">Primary colour</Label><div className="flex items-center gap-2"><input id="primaryColor" type="color" value={values.primaryColor} readOnly className="size-10 rounded-lg border bg-background p-1" /><Input aria-label="Primary colour hex" defaultValue={values.primaryColor} name="primaryColor" /></div></div>
            <div className="space-y-2"><Label htmlFor="accentColor">Accent colour</Label><div className="flex items-center gap-2"><input id="accentColor" type="color" value={values.accentColor} readOnly className="size-10 rounded-lg border bg-background p-1" /><Input aria-label="Accent colour hex" defaultValue={values.accentColor} name="accentColor" /></div></div>
          </div>
          <div className="space-y-2"><Label htmlFor="customDomain">Custom domain</Label><div className="flex gap-2"><Input id="customDomain" name="customDomain" defaultValue={values.customDomain ?? ""} placeholder="social.example.com" /><Globe2 className="mt-2 size-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Reserved for domain verification and routing. Saving the hostname does not claim the domain.</p></div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : <><Save />Save branding</>}</Button>
        </CardContent>
      </Card>
      <Card className="h-fit overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm">
        <CardHeader><CardTitle>Live identity preview</CardTitle><CardDescription>Uses the same visual language as the existing OmniSocial workspace.</CardDescription></CardHeader>
        <CardContent><div className="rounded-2xl border bg-background p-5"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: values.primaryColor }}><Sparkles className="size-4" /></span><div><p className="font-semibold">{values.name}</p><p className="text-xs text-muted-foreground">Publishing workspace</p></div></div><div className="mt-5 rounded-xl border p-4"><div className="h-2 rounded-full" style={{ backgroundColor: values.accentColor }} /><p className="mt-3 text-sm font-medium">Custom workspace branding</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Brand identity is isolated per workspace.</p></div></div></CardContent>
      </Card>
    </form>
  );
}
