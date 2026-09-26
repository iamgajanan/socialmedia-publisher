import { NextResponse } from "next/server";
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
  url.searchParams.set("scope", config.scopes.join(platform === "tiktok" || platform === "facebook" || platform === "instagram" ? "," : " "));

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

  return NextResponse.redirect(url);
}
