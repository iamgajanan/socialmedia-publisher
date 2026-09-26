import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/social/token-crypto";
import { getPkceVerifierCookieName, getProviderConfig, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/oauth";

function isPlatform(value: string): value is SocialPlatform { return SOCIAL_PLATFORMS.includes(value as SocialPlatform); }
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; open_id?: string };

function profileValues(platform: SocialPlatform, payload: any) {
  if (platform === "youtube") { const item = payload?.items?.[0]; return { id: item?.id, name: item?.snippet?.title, username: item?.snippet?.customUrl, avatar: item?.snippet?.thumbnails?.default?.url, url: item?.id ? `https://youtube.com/channel/${item.id}` : null }; }
  if (platform === "x") { const item = payload?.data; return { id: item?.id, name: item?.name, username: item?.username, avatar: item?.profile_image_url, url: item?.username ? `https://x.com/${item.username}` : null }; }
  if (platform === "tiktok") { const item = payload?.data?.user ?? payload?.data; return { id: item?.open_id, name: item?.display_name, username: item?.username, avatar: item?.avatar_url, url: item?.profile_deep_link }; }
  if (platform === "linkedin") return { id: payload?.sub, name: payload?.name, username: payload?.email, avatar: payload?.picture, url: null };
  return { id: payload?.id, name: payload?.name, username: payload?.username, avatar: payload?.picture?.data?.url ?? payload?.picture, url: null };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const state = url.searchParams.get("state");
  const expectedState = store.get("social_oauth_state")?.value;
  const platformValue = store.get("social_oauth_platform")?.value;
  const pkce = store.get(getPkceVerifierCookieName())?.value;
  const code = url.searchParams.get("code");

  store.delete("social_oauth_state"); store.delete("social_oauth_platform"); store.delete(getPkceVerifierCookieName());

  if (!state || !expectedState || state !== expectedState || !platformValue || !isPlatform(platformValue)) return NextResponse.redirect(new URL("/connect-accounts?error=state", request.url));
  const platform = platformValue;
  if (!code) return NextResponse.redirect(new URL(`/connect-accounts?error=denied&platform=${platform}`, request.url));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/auth/login", request.url));

  const config = getProviderConfig(platform);
  if (!config) return NextResponse.redirect(new URL(`/connect-accounts?error=setup&platform=${platform}`, request.url));

  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
  if (config.tokenClientKey) { body.set(config.tokenClientKey, config.clientId); body.set("client_secret", config.clientSecret); }
  else { body.set("client_id", config.clientId); if (!config.clientSecretInBasicAuth) body.set("client_secret", config.clientSecret); }
  if (pkce) body.set("code_verifier", pkce);

  const headers: HeadersInit = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (config.clientSecretInBasicAuth) headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;

  const tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL(`/connect-accounts?error=token&platform=${platform}`, request.url));
  const tokens = (await tokenResponse.json()) as TokenResponse;
  if (!tokens.access_token) return NextResponse.redirect(new URL(`/connect-accounts?error=token&platform=${platform}`, request.url));

  let profilePayload: any = {};
  const profileResponse = await fetch(config.profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  if (profileResponse.ok) profilePayload = await profileResponse.json();

  const values = profileValues(platform, profilePayload);
  const externalId = String(values.id || tokens.open_id || "");
  if (!externalId) return NextResponse.redirect(new URL(`/connect-accounts?error=profile&platform=${platform}`, request.url));

  const admin = createAdminClient();
  const { error } = await admin.from("socialmedia_social_accounts").upsert({
    profile_id: String(userId), platform, account_name: String(values.name || values.username || platform), external_account_id: externalId,
    username: values.username ? String(values.username) : null, avatar_url: values.avatar ? String(values.avatar) : null, status: "connected",
    provider_account_url: values.url ? String(values.url) : null, scopes: tokens.scope ? tokens.scope.split(/[ ,]+/).filter(Boolean) : config.scopes,
    access_token_ciphertext: encryptToken(tokens.access_token), refresh_token_ciphertext: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    token_expires_at: typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    refresh_token_expires_at: typeof tokens.refresh_expires_in === "number" ? new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString() : null,
  }, { onConflict: "profile_id,platform,external_account_id" });

  if (error) return NextResponse.redirect(new URL(`/connect-accounts?error=save&platform=${platform}`, request.url));
  return NextResponse.redirect(new URL("/connect-accounts?connected=1", request.url));
}
