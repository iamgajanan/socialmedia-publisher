import "server-only";

export const SOCIAL_PLATFORMS = ["facebook","instagram","linkedin","x","youtube","tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type ProviderConfig = {
  clientId: string; clientSecret: string; authorizationUrl: string; tokenUrl: string; profileUrl: string;
  scopes: string[]; redirectUri: string; usePkce?: boolean; clientSecretInBasicAuth?: boolean; tokenClientKey?: string;
};

function env(name: string) { return process.env[name]?.trim() || ""; }

function siteUrl() {
  const configured = env("SITE_URL");
  if (configured) return new URL(configured).toString().replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("SITE_URL must be configured in production.");
  return "http://localhost:3000";
}

export function getProviderConfig(platform: SocialPlatform): ProviderConfig | null {
  const redirectUri = new URL("/api/social/oauth/callback", siteUrl()).toString();
  switch (platform) {
    case "youtube":
      if (!env("GOOGLE_CLIENT_ID") || !env("GOOGLE_CLIENT_SECRET")) return null;
      return { clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET"), authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", scopes: [env("YOUTUBE_OAUTH_SCOPES") || "https://www.googleapis.com/auth/youtube.upload"], redirectUri };
    case "linkedin":
      if (!env("LINKEDIN_CLIENT_ID") || !env("LINKEDIN_CLIENT_SECRET")) return null;
      return { clientId: env("LINKEDIN_CLIENT_ID"), clientSecret: env("LINKEDIN_CLIENT_SECRET"), authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization", tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken", profileUrl: "https://api.linkedin.com/v2/userinfo", scopes: [env("LINKEDIN_OAUTH_SCOPES") || "openid profile email w_member_social"], redirectUri };
    case "x":
      if (!env("X_CLIENT_ID") || !env("X_CLIENT_SECRET")) return null;
      return { clientId: env("X_CLIENT_ID"), clientSecret: env("X_CLIENT_SECRET"), authorizationUrl: "https://x.com/i/oauth2/authorize", tokenUrl: "https://api.x.com/2/oauth2/token", profileUrl: "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", scopes: (env("X_OAUTH_SCOPES") || "users.read tweet.read tweet.write offline.access").split(" ").filter(Boolean), redirectUri, usePkce: true, clientSecretInBasicAuth: true };
    case "tiktok":
      if (!env("TIKTOK_CLIENT_KEY") || !env("TIKTOK_CLIENT_SECRET")) return null;
      return { clientId: env("TIKTOK_CLIENT_KEY"), clientSecret: env("TIKTOK_CLIENT_SECRET"), authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/", tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/", profileUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,profile_deep_link", scopes: (env("TIKTOK_OAUTH_SCOPES") || "user.info.basic,video.publish").split(",").map((v) => v.trim()).filter(Boolean), redirectUri, tokenClientKey: "client_key" };
    case "facebook":
    case "instagram": {
      const version = env("META_GRAPH_VERSION");
      if (!env("META_APP_ID") || !env("META_APP_SECRET") || !version) return null;
      const profileUrl = env(platform === "facebook" ? "FACEBOOK_PROFILE_URL" : "INSTAGRAM_PROFILE_URL");
      if (!profileUrl) return null;
      const scopes = env(platform === "facebook" ? "FACEBOOK_OAUTH_SCOPES" : "INSTAGRAM_OAUTH_SCOPES") || (platform === "facebook" ? "pages_show_list,pages_read_engagement,pages_manage_posts" : "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement");
      return { clientId: env("META_APP_ID"), clientSecret: env("META_APP_SECRET"), authorizationUrl: `https://www.facebook.com/${version}/dialog/oauth`, tokenUrl: `https://graph.facebook.com/${version}/oauth/access_token`, profileUrl, scopes: scopes.split(",").map((v) => v.trim()).filter(Boolean), redirectUri };
    }
  }
}

export function getRedirectUri() { return new URL("/api/social/oauth/callback", siteUrl()).toString(); }
export function getPkceVerifierCookieName() { return "social_oauth_pkce"; }
