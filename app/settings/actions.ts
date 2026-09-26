"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

type SettingsState = { error: string | null; success: string | null };

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required.").max(80),
});

const workspaceSchema = z.object({
  workspaceName: z.string().trim().min(1, "Workspace name is required.").max(80),
  timezone: z.string().trim().min(1),
  autoSaveDrafts: z.boolean(),
  defaultStatus: z.enum(["draft", "scheduled"]),
});

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/auth/login");
  }

  return { supabase, userId: String(data.claims.sub) };
}

export async function updateProfile(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name.", success: null };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("socialmedia_profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", userId);

  return error
    ? { error: error.message, success: null }
    : { error: null, success: "Profile updated successfully." };
}

export async function updateWorkspace(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = workspaceSchema.safeParse({
    workspaceName: formData.get("workspaceName"),
    timezone: formData.get("timezone"),
    autoSaveDrafts: formData.get("autoSaveDrafts") === "on",
    defaultStatus: formData.get("defaultStatus"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid workspace settings.", success: null };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("socialmedia_profiles")
    .update({
      workspace_name: parsed.data.workspaceName,
      timezone: parsed.data.timezone,
      default_posting_preferences: {
        autoSaveDrafts: parsed.data.autoSaveDrafts,
        defaultStatus: parsed.data.defaultStatus,
      },
    })
    .eq("id", userId);

  return error
    ? { error: error.message, success: null }
    : { error: null, success: "Workspace preferences saved." };
}

export async function updateEmail(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = z.string().email().safeParse(email);

  if (!parsed.success) return { error: "Enter a valid email address.", success: null };

  const { supabase, userId } = await requireUser();
  if (!(await consumeRateLimit(`email-update:user:${userId}`, 5, 3600))) return { error: "Too many email-change attempts. Please try again later.", success: null };
  const { error } = await supabase.auth.updateUser({ email: parsed.data });

  return error
    ? { error: error.message, success: null }
    : { error: null, success: "Check your inbox to confirm the new email address." };
}

export async function updateAccountPassword(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const password = String(formData.get("password") ?? "");
  const repeatPassword = String(formData.get("repeatPassword") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters.", success: null };
  if (password !== repeatPassword) return { error: "Passwords do not match.", success: null };

  const { supabase, userId } = await requireUser();
  if (!(await consumeRateLimit(`password-update:user:${userId}`, 5, 3600))) return { error: "Too many password-change attempts. Please try again later.", success: null };
  const { error } = await supabase.auth.updateUser({ password });

  return error
    ? { error: error.message, success: null }
    : { error: null, success: "Password updated successfully." };
}

export async function deleteAccount(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  if (String(formData.get("confirmation") ?? "") !== "DELETE") {
    return { error: "Type DELETE to confirm account deletion.", success: null };
  }

  const { supabase, userId } = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) return { error: error.message, success: null };

  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
