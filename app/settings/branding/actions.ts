"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireWorkspaceAdmin } from "@/lib/workspace/server";

const brandingSchema = z.object({
  brandName: z.string().trim().min(1, "Brand name is required.").max(80),
  logoUrl: z.string().trim().url("Logo URL must be a valid URL.").max(500).or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Primary colour must be a 6-digit hex value."),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent colour must be a 6-digit hex value."),
  customDomain: z.string().trim().max(255).refine((value) => !value || /^[a-z0-9.-]+$/i.test(value), "Custom domain contains invalid characters."),
});

export type BrandingState = { ok: boolean; message: string };

export async function updateBranding(_previous: BrandingState, formData: FormData): Promise<BrandingState> {
  const parsed = brandingSchema.safeParse({
    brandName: formData.get("brandName"),
    logoUrl: formData.get("logoUrl"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    customDomain: formData.get("customDomain"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid branding settings." };

  const context = await requireWorkspaceAdmin();
  const { error } = await context.supabase
    .from("socialmedia_workspaces")
    .update({
      name: parsed.data.brandName,
      logo_url: parsed.data.logoUrl || null,
      primary_color: parsed.data.primaryColor.toLowerCase(),
      accent_color: parsed.data.accentColor.toLowerCase(),
      custom_domain: parsed.data.customDomain || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.workspace.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/branding");
  return { ok: true, message: "Workspace branding saved." };
}
