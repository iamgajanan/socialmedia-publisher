import Link from "next/link";
import { Palette } from "lucide-react";
import { redirect } from "next/navigation";

import { BrandingForm } from "@/components/settings/branding-form";
import { Badge } from "@/components/ui/badge";
import { getCurrentWorkspace } from "@/lib/workspace/server";

export const instant = false;

export default async function BrandingPage() {
  const context = await getCurrentWorkspace();
  if (context.membership.role !== "owner" && context.membership.role !== "admin") redirect("/settings");

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <Badge variant="secondary" className="rounded-full px-3 py-1"><Palette className="mr-1.5 size-3.5" />White-label</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make the workspace yours.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Set the name, logo, colours, and future custom-domain identity shown across the workspace.</p>
      </div>
      <BrandingForm values={{
        name: context.workspace.name,
        logoUrl: context.workspace.logo_url,
        primaryColor: context.workspace.primary_color,
        accentColor: context.workspace.accent_color,
        customDomain: context.workspace.custom_domain,
      }} />
      <p className="text-sm text-muted-foreground"><Link href="/settings" className="text-primary hover:underline">Back to Settings</Link></p>
    </div>
  );
}
