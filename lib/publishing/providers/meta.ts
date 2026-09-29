import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";
import { buildFacebookPublishRequest } from "./meta-facebook-request";

function graphVersion() {
  const value = process.env.META_GRAPH_VERSION?.trim();
  if (!value) throw new PublisherError("META_GRAPH_VERSION is not configured.", { code: "meta_setup" });
  return value;
}

function instagramGraphBase() {
  return `https://graph.instagram.com/${graphVersion()}`;
}

function pageContext(accessToken: string, accountId: string) {
  if (!accountId) {
    throw new PublisherError("The connected Facebook Page ID is missing.", { code: "meta_page_not_found" });
  }
  if (!accessToken) {
    throw new PublisherError("The connected Facebook Page token is missing.", { code: "meta_page_token_missing" });
  }
  return { id: accountId, accessToken };
}

export const facebookPublisher: Publisher = {
  platform: "facebook",
  validate(input) {
    if (!input.content.trim() && input.media.length === 0) throw new PublisherError("Facebook posts need text or media.", { code: "empty_post" });
    if (input.media.length > 1) throw new PublisherError("Facebook publishing currently supports one media asset per destination.", { code: "facebook_media_count" });
  },
  async publish(input, accessToken) {
    const version = graphVersion();
    const page = pageContext(accessToken, input.account.external_account_id);
    const media = input.media[0];
    const request = buildFacebookPublishRequest(
      version,
      page.id,
      page.accessToken,
      input.content,
      media ? { url: media.url, mimeType: media.mimeType } : undefined,
    );
    const response = await providerFetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: request.body,
    });
    const data = await response.json() as { id?: string; post_id?: string };
    const id = data.post_id ?? data.id;
    if (!id) throw new PublisherError("Facebook published the post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: id };
  },
  async getAccount(accessToken) {
    const version = graphVersion();
    const response = await providerFetch(`https://graph.facebook.com/${version}/me?fields=id,name`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as { id?: string; name?: string };
    return { external_account_id: data.id, account_name: data.name };
  },
};


