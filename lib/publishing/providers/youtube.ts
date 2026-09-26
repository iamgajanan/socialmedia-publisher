import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type PublishInput, type Publisher } from "./types";

export const youtubePublisher: Publisher = {
  platform: "youtube",
  validate(input) {
    if (input.media.length !== 1 || !input.media[0].mimeType.startsWith("video/")) throw new PublisherError("YouTube publishing requires exactly one video.", { code: "youtube_video_required" });
    if (input.content.length > 5000) throw new PublisherError("YouTube description exceeds 5,000 characters.", { code: "content_too_long" });
  },
  async publish(input, accessToken) {
    const media = await fetch(input.media[0].url, { cache: "no-store" });
    if (!media.ok) throw new PublisherError("The stored video could not be downloaded for YouTube.", { retryable: true, code: "media_download_failed" });
    const bytes = await media.arrayBuffer();
    const metadata = { snippet: { title: input.account.metadata.youtube_title ? String(input.account.metadata.youtube_title) : input.content.slice(0, 100) || "Untitled video", description: input.content, categoryId: String(input.account.metadata.youtube_category_id ?? "22") }, status: { privacyStatus: String(input.account.metadata.youtube_privacy_status ?? "public"), selfDeclaredMadeForKids: false } };
    const boundary = `social-publisher-${crypto.randomUUID()}`;
    const encoder = new TextEncoder();
    const prefix = encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${input.media[0].mimeType}\r\n\r\n`);
    const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array(prefix.byteLength + bytes.byteLength + suffix.byteLength);
    body.set(prefix, 0); body.set(new Uint8Array(bytes), prefix.byteLength); body.set(suffix, prefix.byteLength + bytes.byteLength);
    const response = await providerFetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
    const data = await response.json() as { id?: string };
    if (!data.id) throw new PublisherError("YouTube accepted the upload but did not return a video ID.", { code: "missing_video_id" });
    return { platformPostId: data.id };
  },
  async refreshToken(account, refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim(); const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim(); if (!clientId || !clientSecret) return null;
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const response = await providerFetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    return data.access_token ? { accessToken: data.access_token, expiresIn: data.expires_in } : null;
  },
  async getAccount(accessToken) {
    const response = await providerFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
    const root = await response.json() as { items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }> };
    const channel = root.items?.[0];
    return { external_account_id: channel?.id, account_name: channel?.snippet?.title, username: channel?.snippet?.customUrl, avatar_url: channel?.snippet?.thumbnails?.default?.url };
  },
};
