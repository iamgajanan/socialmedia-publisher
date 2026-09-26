import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type PublishInput, type Publisher } from "./types";

export const xPublisher: Publisher = {
  platform: "x",
  validate(input) {
    if (!input.content.trim()) throw new PublisherError("X posts need text.", { code: "empty_post" });
    if (input.content.length > 280) throw new PublisherError("X content exceeds 280 characters.", { code: "content_too_long" });
    if (input.media.length > 0) throw new PublisherError("X media publishing requires a separately configured media-upload integration; this account currently supports text publishing only.", { code: "x_media_not_configured" });
  },
  async publish(input, accessToken) {
    const response = await providerFetch("https://api.x.com/2/tweets", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: input.content }) });
    const data = await response.json() as { data?: { id?: string } };
    if (!data.data?.id) throw new PublisherError("X published the post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: data.data.id };
  },
  async refreshToken(account, refreshToken) {
    const clientId = process.env.X_CLIENT_ID?.trim(); const clientSecret = process.env.X_CLIENT_SECRET?.trim(); if (!clientId || !clientSecret) return null;
    const body = new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: clientId });
    const response = await providerFetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    return data.access_token ? { accessToken: data.access_token, expiresIn: data.expires_in } : null;
  },
  async getAccount(accessToken) {
    const response = await providerFetch("https://api.x.com/2/users/me?user.fields=name,username,profile_image_url", { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as { data?: { id?: string; name?: string; username?: string; profile_image_url?: string } };
    return { external_account_id: data.data?.id, account_name: data.data?.name, username: data.data?.username, avatar_url: data.data?.profile_image_url };
  },
};
