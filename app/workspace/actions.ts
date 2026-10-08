"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function switchWorkspace(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  if (!workspaceId) return;

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");

  const profileId = String(claims.claims.sub);
  const { data: membership, error: membershipError } = await supabase
    .from("socialmedia_workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) return;

  const { error } = await supabase
    .from("socialmedia_profiles")
    .update({ workspace_id: workspaceId })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
