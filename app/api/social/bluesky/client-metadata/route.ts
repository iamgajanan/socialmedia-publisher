import { NextResponse } from "next/server";

function siteUrl() {
  const configured = process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (configured) return (configured.startsWith("http") ? configured : `https://${configured}`).replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function GET() {
  const clientId = process.env.BLUESKY_CLIENT_ID?.trim() || `${siteUrl()}/api/social/bluesky/client-metadata`;
  const redirectUri = `${siteUrl()}/api/social/oauth/callback`;
  return NextResponse.json({
    client_id: clientId,
    client_name: "OmniSocial",
    client_uri: siteUrl(),
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    scope: "atproto repo:app.bsky.feed.post blob:*/*",
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  }, { headers: { "Cache-Control": "public, max-age=60, must-revalidate" } });
}
