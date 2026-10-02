"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";

export async function createPublishingUser(formData: FormData) {
  const context = await requireWorkspaceAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Please enter a user name.");
  const { error } = await context.supabase.from("socialmedia_users").insert({
    workspace_id: context.workspace.id,
    name,
  });
  if (error) {
    if (error.message.includes("USER_LIMIT_REACHED")) {
      const limit = context.plan.max_users;
      throw new Error(`Your ${context.plan.name} plan allows up to ${limit} publishing user${limit === 1 ? "" : "s"}. Upgrade your plan to add more.`);
    }
    throw new Error(error.message);
  }
  revalidatePath("/users");
  revalidatePath("/connect-accounts");
}

export async function renamePublishingUser(formData: FormData) {
  const context = await requireWorkspaceAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("User name is required.");
  const { error } = await context.supabase.from("socialmedia_users").update({ name, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", context.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/users");
  revalidatePath("/connect-accounts");
}

export async function deletePublishingUser(formData: FormData) {
  const context = await requireWorkspaceAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("User is required.");
  const { count, error: countError } = await context.supabase.from("socialmedia_users").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) <= 1) throw new Error("Keep at least one publishing user in your workspace.");
  const { error } = await context.supabase.from("socialmedia_users").delete().eq("id", id).eq("workspace_id", context.workspace.id);
  if (error) throw new Error(error.message);
  revalidatePath("/users");
  revalidatePath("/connect-accounts");
}
