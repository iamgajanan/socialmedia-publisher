import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, requestFingerprint } from "@/lib/security/rate-limit";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

import { SOCIAL_PLATFORMS, getPkceVerifierCookieName, getProviderConfig, type SocialPlatform } from "@/lib/social/oauth";

function isPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

function createVerifier() {
  return randomBytes(48).toString("base64url");
}

function createChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isPlatform(platform)) return NextResponse.redirect(new URL("/connect-accounts?error=unsupported", request.url));

  const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub; if (!userId) return NextResponse.redirect(new URL("/auth/login", request.url)); if (!(await consumeRateLimit(`oauth-start:user:${String(userId)}`,10,600)) || !(await consumeRateLimit(`oauth-start:ip:${await requestFingerprint()}`,20,600))) return NextResponse.redirect(new URL(`/connect-accounts?error=rate_limit&platform=${platform}`,request.url));
  const config = getProviderConfig(platform);
  if (!config) return NextResponse.redirect(new URL(`/connect-accounts?error=setup&platform=${platform}`, request.url));

  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  store.set("social_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  store.set("social_oauth_platform", platform, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (config.configId) {
    // Facebook Login for Business uses the configuration's permission set.
    // Do not send legacy scopes or override the response type alongside config_id.
    url.searchParams.set("config_id", config.configId);
  } else {
    url.searchParams.set("scope", config.scopes.join(platform === "tiktok" || platform === "facebook" || platform === "instagram" || platform === "threads" ? "," : " "));
  }

  if (config.instagramLogin) {
    url.searchParams.set("enable_fb_login", "0");
    url.searchParams.set("force_authentication", "1");
  }

  if (platform === "youtube") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
  }

  if (config.usePkce) {
    const verifier = createVerifier();
    store.set(getPkceVerifierCookieName(), verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
    url.searchParams.set("code_challenge", createChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (platform === "facebook") {
    console.info("[facebook-oauth-diagnostic]", {
      clientIdPresent: Boolean(config.clientId),
      configIdPresent: Boolean(config.configId),
      configId: config.configId ?? null,
      redirectUri: config.redirectUri,
      responseType: url.searchParams.get("response_type"),
      overrideDefaultResponseType: url.searchParams.get("override_default_response_type"),
      scopePresent: url.searchParams.has("scope"),
      authorizationHost: url.host,
      authorizationPath: url.pathname,
    });
  }

  return NextResponse.redirect(url);
}
