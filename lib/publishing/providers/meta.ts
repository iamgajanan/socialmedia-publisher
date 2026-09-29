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
    const body = new URLSearchParams({ caption: input.content });
    body.set("access_token", accessToken);
    if (media.mimeType.startsWith("video/")) {
      body.set("media_type", "REELS");
      body.set("video_url", media.url);
    } else {
      body.set("image_url", media.url);
    }

    const containerResponse = await providerFetch(`${base}/${igId}/media`, {
      method: "POST",
      body,
    });
    const container = await containerResponse.json() as { id?: string };
    if (!container.id) throw new PublisherError("Instagram did not return a media container ID.", { code: "missing_container_id" });

    // Poll every Instagram media container before publishing. Images can also
    // take a few seconds to become publishable; publishing too early returns
    // Meta error 9007 / 2207027 ("Media ID is not available").
    let containerReady = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const statusResponse = await providerFetch(
        `${base}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
        { method: "GET" },
      );
      const status = await statusResponse.json() as { status_code?: string; status?: string };
      if (status.status_code === "FINISHED" || status.status_code === "PUBLISHED") {
        containerReady = true;
        break;
      }
      if (status.status_code === "ERROR") {
        throw new PublisherError(status.status || "Instagram media processing failed.", { code: "instagram_processing_failed" });
      }
      if (status.status_code === "EXPIRED") {
        throw new PublisherError("Instagram media container expired before publishing.", { retryable: true, code: "instagram_container_expired" });
      }
      if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    if (!containerReady) {
      throw new PublisherError("Instagram media is still processing; retry later.", { retryable: true, code: "instagram_processing" });
    }

    const publishResponse = await providerFetch(`${base}/${igId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
    });
    const result = await publishResponse.json() as { id?: string };
    if (!result.id) throw new PublisherError("Instagram published the media but did not return a media ID.", { code: "missing_post_id" });
    return { platformPostId: result.id };
  },
  async getAccount(accessToken) {
    const response = await providerFetch(
      `${instagramGraphBase()}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(accessToken)}`,
      { method: "GET" },
    );
    const data = await response.json() as { user_id?: string; username?: string; account_type?: string };
    return { external_account_id: data.user_id, account_name: data.username ? `@${data.username}` : "Instagram" };
  },
};
