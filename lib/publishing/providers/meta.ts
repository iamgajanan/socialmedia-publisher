import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";

function graphVersion() {
  const value = process.env.META_GRAPH_VERSION?.trim();
  if (!value) throw new PublisherError("META_GRAPH_VERSION is not configured.", { code: "meta_setup" });
  return value;
}
async function pageContext(accessToken: string, accountId: string) {
  const version = graphVersion();
  const response = await providerFetch(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`, { method: "GET" });
  const data = await response.json() as { data?: Array<{ id?: string; name?: string; access_token?: string; instagram_business_account?: { id?: string } }> };
  const page = data.data?.find((item) => item.id === accountId) ?? data.data?.[0];
  if (!page?.id || !page.access_token) throw new PublisherError("No publishable Facebook Page was found for this connected Meta account.", { code: "meta_page_not_found" });
  return page;
}
export const facebookPublisher: Publisher = {
  platform: "facebook",
  validate(input) {
    if (!input.content.trim() && input.media.length === 0) throw new PublisherError("Facebook posts need text or media.", { code: "empty_post" });
    if (input.media.length > 1) throw new PublisherError("Facebook publishing currently supports one media asset per destination.", { code: "facebook_media_count" });
  },
  async publish(input, accessToken) {
    const version = graphVersion(); const page = await pageContext(accessToken, input.account.external_account_id);
    if (!input.media.length) {
      const response = await providerFetch(`https://graph.facebook.com/${version}/${page.id}/feed`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ message: input.content, access_token: page.access_token }) });
      const data = await response.json() as { id?: string };
      if (!data.id) throw new PublisherError("Facebook published the post but did not return a post ID.", { code: "missing_post_id" });
      return { platformPostId: data.id };
    }
    const media = input.media[0];
    const endpoint = media.mimeType.startsWith("image/") ? `https://graph.facebook.com/${version}/${page.id}/photos` : `https://graph.facebook.com/${version}/${page.id}/videos`;
    const params = media.mimeType.startsWith("image/") ? { url: media.url, caption: input.content, access_token: page.access_token } : { file_url: media.url, description: input.content, access_token: page.access_token };
    const response = await providerFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
    const data = await response.json() as { id?: string; post_id?: string };
    const id = data.post_id ?? data.id;
    if (!id) throw new PublisherError("Facebook published the media but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: id };
  },
  async getAccount(accessToken) {
    const version = graphVersion(); const response = await providerFetch(`https://graph.facebook.com/${version}/me?fields=id,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as { id?: string; name?: string };
    return { external_account_id: data.id, account_name: data.name };
  },
};
export const instagramPublisher: Publisher = {
  platform: "instagram",
  validate(input) {
    if (input.media.length !== 1) throw new PublisherError("Instagram publishing currently requires exactly one image or video.", { code: "instagram_media_required" });
    if (input.content.length > 2200) throw new PublisherError("Instagram caption exceeds 2,200 characters.", { code: "content_too_long" });
  },
  async publish(input, accessToken) {
    const version = graphVersion();
    const page = await pageContext(accessToken, input.account.metadata.facebook_page_id ? String(input.account.metadata.facebook_page_id) : "");
    const igId = input.account.metadata.instagram_business_account_id ? String(input.account.metadata.instagram_business_account_id) : page.instagram_business_account?.id;
    if (!igId) throw new PublisherError("No Instagram professional account is linked to the connected Facebook Page.", { code: "instagram_account_not_found" });
    const media = input.media[0];
    const body = new URLSearchParams({ caption: input.content, access_token: page.access_token });
    if (media.mimeType.startsWith("video/")) { body.set("media_type", "REELS"); body.set("video_url", media.url); } else { body.set("image_url", media.url); }
    const containerResponse = await providerFetch(`https://graph.facebook.com/${version}/${igId}/media`, { method: "POST", body });
    const container = await containerResponse.json() as { id?: string };
    if (!container.id) throw new PublisherError("Instagram did not return a media container ID.", { code: "missing_container_id" });
    if (media.mimeType.startsWith("video/")) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusResponse = await providerFetch(`https://graph.facebook.com/${version}/${container.id}?fields=status_code&access_token=${encodeURIComponent(page.access_token)}`, { method: "GET" });
        const status = await statusResponse.json() as { status_code?: string };
        if (status.status_code === "ERROR") throw new PublisherError("Instagram video processing failed.", { code: "instagram_processing_failed" });
        if (status.status_code === "FINISHED") break;
        if (attempt === 19) throw new PublisherError("Instagram video is still processing; retry later.", { retryable: true, code: "instagram_processing" });
      }
    }
    const publishResponse = await providerFetch(`https://graph.facebook.com/${version}/${igId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: container.id, access_token: page.access_token }) });
    const result = await publishResponse.json() as { id?: string };
    if (!result.id) throw new PublisherError("Instagram published the media but did not return a media ID.", { code: "missing_post_id" });
    return { platformPostId: result.id };
  },
  async getAccount(accessToken) {
    const version = graphVersion(); const response = await providerFetch(`https://graph.facebook.com/${version}/me?fields=id,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as { id?: string; name?: string };
    return { external_account_id: data.id, account_name: data.name };
  },
};
