import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, requestFingerprint } from "@/lib/security/rate-limit";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

import { SOCIAL_PLATFORMS, getPkceVerifierCookieName, getProviderConfig, type SocialPlatform } from "@/lib/social/oauth";

function isPlatform(value: string): value is SocialPlatform { return SOCIAL_PLATFORMS.includes(value as SocialPlatform); }
function createVerifier() { return randomBytes(48).toString("base64url"); }
function createChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isPlatform(platform)) return NextResponse.redirect(new URL("/connect-accounts?error=unsupported", request.url));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/auth/login", request.url));
  if (!(await consumeRateLimit(`oauth-start:user:${String(userId)}`, 10, 600)) || !(await consumeRateLimit(`oauth-start:ip:${await requestFingerprint()}`, 20, 600))) return NextResponse.redirect(new URL(`/connect-accounts?error=rate_limit&platform=${platform}`, request.url));

  const config = getProviderConfig(platform);
  if (!config) return NextResponse.redirect(new URL(`/connect-accounts?error=setup&platform=${platform}`, request.url));

  const workspaceUserId = new URL(request.url).searchParams.get("user");
  const { data: profile } = await supabase.from("socialmedia_profiles").select("workspace_id").eq("id", String(userId)).maybeSingle();
  if (!profile?.workspace_id) return NextResponse.redirect(new URL("/users?error=workspace", request.url));
  const { data: selectedUser } = await supabase.from("socialmedia_users").select("id").eq("id", workspaceUserId ?? "").eq("workspace_id", profile.workspace_id).maybeSingle();
  if (!selectedUser) return NextResponse.redirect(new URL("/connect-accounts?error=user_required", request.url));

  const [{ data: workspace }, { data: existingAccount }, { count: connectedCount }] = await Promise.all([
    supabase.from("socialmedia_workspaces").select("plan_id").eq("id", profile.workspace_id).single(),
    supabase.from("socialmedia_social_accounts").select("id").eq("workspace_id", profile.workspace_id).eq("socialmedia_user_id", selectedUser.id).eq("platform", platform).limit(1).maybeSingle(),
    supabase.from("socialmedia_social_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", profile.workspace_id).eq("status", "connected"),
  ]);
  if (!workspace) return NextResponse.redirect(new URL("/users?error=workspace", request.url));
  const { data: plan } = await supabase.from("socialmedia_plans").select("max_social_accounts").eq("id", workspace.plan_id).single();
  if (!plan) return NextResponse.redirect(new URL("/users?error=plan", request.url));
  if (!existingAccount && (connectedCount ?? 0) >= plan.max_social_accounts) return NextResponse.redirect(new URL(`/connect-accounts?error=account_limit&platform=${platform}&user=${selectedUser.id}`, request.url));

  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: 600, path: "/" };
  store.set("social_oauth_state", state, cookieOptions);
  store.set("social_oauth_platform", platform, cookieOptions);
  store.set("social_oauth_user", selectedUser.id, cookieOptions);

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (config.configId) url.searchParams.set("config_id", config.configId);
  else url.searchParams.set("scope", config.scopes.join(platform === "tiktok" || platform === "facebook" || platform === "instagram" || platform === "threads" ? "," : " "));
  if (config.instagramLogin) { url.searchParams.set("enable_fb_login", "0"); url.searchParams.set("force_authentication", "1"); }
  if (platform === "youtube") { url.searchParams.set("access_type", "offline"); url.searchParams.set("include_granted_scopes", "true"); url.searchParams.set("prompt", "consent"); }
  if (config.usePkce) { const verifier = createVerifier(); store.set(getPkceVerifierCookieName(), verifier, cookieOptions); url.searchParams.set("code_challenge", createChallenge(verifier)); url.searchParams.set("code_challenge_method", "S256"); }

  return NextResponse.redirect(url);
}
