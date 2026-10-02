"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, requestFingerprint } from "@/lib/security/rate-limit";
import { z } from "zod";

type AuthState = { error: string | null };
const planSchema = z.enum(["free", "starter", "pro", "premium"]);

async function getOrigin() {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "development") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const protocol = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${protocol}://${host}`;
  }
  throw new Error("SITE_URL must be configured in production.");
}

export async function login(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  if (!(await consumeRateLimit(`login:ip:${await requestFingerprint()}`, 10, 600)) || !(await consumeRateLimit(`login:email:${email}`, 10, 600))) return { error: "Too many sign-in attempts. Please try again later." };
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signUp(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  if (!(await consumeRateLimit(`signup:ip:${await requestFingerprint()}`, 5, 600))) return { error: "Too many sign-up attempts. Please try again later." };
  const password = String(formData.get("password") ?? "");
  const repeatPassword = String(formData.get("repeatPassword") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const selectedPlan = String(formData.get("plan") ?? "free");
  if (!planSchema.safeParse(selectedPlan).success) return { error: "Choose a valid OmniSocial plan." };
  if (!email || !password) return { error: "Email and password are required." };
  if (password !== repeatPassword) return { error: "Passwords do not match." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      data: {
        ...(displayName ? { full_name: displayName } : {}),
        plan: selectedPlan,
      },
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  redirect("/auth/sign-up-success");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function requestPasswordReset(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  if (!(await consumeRateLimit(`reset:ip:${await requestFingerprint()}`, 5, 600)) || !(await consumeRateLimit(`reset:email:${email}`, 5, 600))) return { error: "Too many password-reset requests. Please try again later." };
  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/auth/update-password` });
  return error ? { error: error.message } : { error: null };
}

export async function updatePassword(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await consumeRateLimit(`password-update:ip:${await requestFingerprint()}`, 5, 600))) return { error: "Too many password-update attempts. Please try again later." };
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
