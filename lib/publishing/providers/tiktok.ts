import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type PublishInput, type Publisher } from "./types";

export const tiktokPublisher: Publisher = {
  platform: "tiktok",
  validate(input) {
    if (input.media.length !== 1 || !input.media[0].mimeType.startsWith("video/")) throw new PublisherError("TikTok direct publishing requires exactly one video.", { code: "tiktok_video_required" });
    if (input.content.length > 2200) throw new PublisherError("TikTok caption exceeds the 2,200 UTF-16 rune limit.", { code: "content_too_long" });
  },
  async publish(input, accessToken) {
    const creator = await providerFetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: "{}" });
    const creatorData = await creator.json() as { data?: { privacy_level_options?: string[] } };
    const privacy = creatorData.data?.privacy_level_options?.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : creatorData.data?.privacy_level_options?.[0];
    if (!privacy) throw new PublisherError("TikTok did not return an available privacy level.", { code: "tiktok_creator_info" });
    const init = await providerFetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ post_info: { title: input.content, privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false }, source_info: { source: "PULL_FROM_URL", video_url: input.media[0].url } }),
    });
    const data = await init.json() as { data?: { publish_id?: string }; error?: { message?: string } };
    const publishId = data.data?.publish_id;
    if (!publishId) throw new PublisherError(data.error?.message || "TikTok did not return a publish ID.", { code: "missing_publish_id" });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const statusResponse = await providerFetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ publish_id: publishId }) });
      const status = await statusResponse.json() as { data?: { status?: string; fail_reason?: string } };
      if (status.data?.status === "PUBLISH_COMPLETE") return { platformPostId: publishId };
      if (status.data?.status === "FAILED") throw new PublisherError(status.data.fail_reason || "TikTok publishing failed.", { code: "tiktok_publish_failed" });
    }
    throw new PublisherError("TikTok publishing is still processing; it will be reconciled by a later worker.", { retryable: true, code: "tiktok_processing" });
  },
  async refreshToken(account, refreshToken) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim(); const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim(); if (!clientKey || !clientSecret) return null;
    const body = new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
    const response = await providerFetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    return data.access_token ? { accessToken: data.access_token, expiresIn: data.expires_in } : null;
  },
  async getAccount(accessToken) {
    const response = await providerFetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url,profile_deep_link", { headers: { Authorization: `Bearer ${accessToken}` } });
    const root = await response.json() as { data?: { user?: { open_id?: string; display_name?: string; username?: string; avatar_url?: string } } };
    const user = root.data?.user;
    return { external_account_id: user?.open_id, account_name: user?.display_name, username: user?.username, avatar_url: user?.avatar_url };
  },
};
