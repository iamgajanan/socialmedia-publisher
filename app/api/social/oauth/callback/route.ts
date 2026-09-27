import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/social/token-crypto";
import { getPkceVerifierCookieName, getProviderConfig, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/oauth";

function isPlatform(value: string): value is SocialPlatform { return SOCIAL_PLATFORMS.includes(value as SocialPlatform); }
type JsonRecord = Record<string, unknown>;
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; open_id?: string };
function record(value: unknown): JsonRecord { return value && typeof value === "object" ? value as JsonRecord : {}; }
function stringValue(value: unknown) { return typeof value === "string" ? value : undefined; }

function profileValues(platform: SocialPlatform, payload: unknown) {
  const root = record(payload);
  if (platform === "youtube") {
    const items = Array.isArray(root.items) ? root.items : [];
    const item = record(items[0]); const snippet = record(item.snippet); const thumbnails = record(snippet.thumbnails); const thumbnail = record(thumbnails.default);
    const id = stringValue(item.id);
    return { id, name: stringValue(snippet.title), username: stringValue(snippet.customUrl), avatar: stringValue(thumbnail.url), url: id ? `https://youtube.com/channel/${id}` : undefined };
  }
  if (platform === "x") {
    const item = record(root.data); const username = stringValue(item.username);
    return { id: stringValue(item.id), name: stringValue(item.name), username, avatar: stringValue(item.profile_image_url), url: username ? `https://x.com/${username}` : undefined };
  }
  if (platform === "threads") {
    return {
      id: stringValue(root.id),
      name: stringValue(root.name),
      username: stringValue(root.username),
      avatar: stringValue(root.threads_profile_picture_url),
      url: stringValue(root.username) ? `https://www.threads.com/@${root.username}` : undefined,
    };
  }
  if (platform === "tiktok") {
    const item = record(root.data && typeof root.data === "object" ? record(root.data).user ?? root.data : root.data);
    return { id: stringValue(item.open_id), name: stringValue(item.display_name), username: stringValue(item.username), avatar: stringValue(item.avatar_url), url: stringValue(item.profile_deep_link) };
  }
  if (platform === "linkedin") return { id: stringValue(root.sub), name: stringValue(root.name), username: stringValue(root.email), avatar: stringValue(root.picture), url: undefined };
  const picture = record(root.picture); const pictureData = record(picture.data);
  return { id: stringValue(root.id), name: stringValue(root.name), username: stringValue(root.username), avatar: stringValue(pictureData.url) ?? stringValue(root.picture), url: undefined };
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

  let profilePayload: unknown = {};
  const profileResponse = await fetch(config.profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  if (profileResponse.ok) profilePayload = await profileResponse.json();

  const values = profileValues(platform, profilePayload);
  const externalId = String(values.id || tokens.open_id || "");
  if (!externalId) return NextResponse.redirect(new URL(`/connect-accounts?error=profile&platform=${platform}`, request.url));

  const admin = createAdminClient();

  // Older accounts can predate the auth trigger that creates this row. Ensure
  // the profile exists before inserting the social account so the FK cannot
  // turn a valid OAuth callback into a generic "save" error.
  const { error: profileError } = await admin
    .from("socialmedia_profiles")
    .upsert({ id: String(userId) }, { onConflict: "id" });

  if (profileError) {
    console.error("social_oauth_profile_save_failed", {
      platform,
      userId: String(userId),
      code: profileError.code,
      message: profileError.message,
    });
    return NextResponse.redirect(new URL(`/connect-accounts?error=save&platform=${platform}`, request.url));
  }

  // OAuth tokens are stored in the server-only secrets table. The social
  // accounts table only stores non-secret account metadata.
  const { data: savedAccount, error: accountError } = await admin
    .from("socialmedia_social_accounts")
    .upsert({
      profile_id: String(userId),
      platform,
      account_name: String(values.name || values.username || platform),
      external_account_id: externalId,
      username: values.username ? String(values.username) : null,
      avatar_url: values.avatar ? String(values.avatar) : null,
      status: "connected",
      provider_account_url: values.url ? String(values.url) : null,
      scopes: tokens.scope
        ? tokens.scope.split(/[ ,]+/).filter(Boolean)
        : config.scopes,
    }, { onConflict: "profile_id,platform,external_account_id" })
    .select("id")
    .single();

  if (accountError || !savedAccount?.id) {
    console.error("social_oauth_account_save_failed", {
      platform,
      userId: String(userId),
      externalAccountId: externalId,
      code: accountError?.code,
      message: accountError?.message,
    });
    return NextResponse.redirect(new URL(`/connect-accounts?error=save&platform=${platform}`, request.url));
  }

  const { error: secretError } = await admin
    .from("socialmedia_account_secrets")
    .upsert({
      social_account_id: savedAccount.id,
      access_token_ciphertext: encryptToken(tokens.access_token),
      refresh_token_ciphertext: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    }, { onConflict: "social_account_id" });

  if (secretError) {
    console.error("social_oauth_secret_save_failed", {
      platform,
      userId: String(userId),
      socialAccountId: String(savedAccount.id),
      code: secretError.code,
      message: secretError.message,
    });
    return NextResponse.redirect(new URL(`/connect-accounts?error=save&platform=${platform}`, request.url));
  }

  return NextResponse.redirect(new URL("/connect-accounts?connected=1", request.url));
}
