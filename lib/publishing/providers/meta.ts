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

async function waitForInstagramContainer(base: string, containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusResponse = await providerFetch(
      `${base}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
      { method: "GET" },
    );
    const status = await statusResponse.json() as { status_code?: string; status?: string };
    if (status.status_code === "FINISHED" || status.status_code === "PUBLISHED") return;
    if (status.status_code === "ERROR") {
      throw new PublisherError(status.status || "Instagram media processing failed.", { code: "instagram_processing_failed" });
    }
    if (status.status_code === "EXPIRED") {
      throw new PublisherError("Instagram media container expired before publishing.", { retryable: true, code: "instagram_container_expired" });
    }
    if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new PublisherError("Instagram media is still processing; retry later.", { retryable: true, code: "instagram_processing" });
}

async function createInstagramImageContainer(base: string, igId: string, accessToken: string, imageUrl: string, isCarouselItem = false) {
  const body = new URLSearchParams({ image_url: imageUrl, access_token: accessToken });
  if (isCarouselItem) body.set("is_carousel_item", "true");
  const response = await providerFetch(`${base}/${igId}/media`, { method: "POST", body });
  const data = await response.json() as { id?: string };
  if (!data.id) throw new PublisherError("Instagram did not return a media container ID.", { code: "missing_container_id" });
  return data.id;
}

export const instagramPublisher: Publisher = {
  platform: "instagram",
  validate(input) {
    if (input.media.length < 1 || input.media.length > 10) {
      throw new PublisherError("Instagram supports 1 to 10 media items per post.", { code: "instagram_media_count" });
    }
    if (input.media.length > 1 && input.media.some((media) => !media.mimeType.startsWith("image/"))) {
      throw new PublisherError("Instagram carousel posts currently support images only.", { code: "instagram_carousel_media_type" });
    }
    if (input.content.length > 2200) throw new PublisherError("Instagram caption exceeds 2,200 characters.", { code: "content_too_long" });
  },
  async publish(input, accessToken) {
    const base = instagramGraphBase();
    const igId = input.account.external_account_id;
    if (!igId) throw new PublisherError("The connected Instagram account ID is missing.", { code: "instagram_account_not_found" });
    if (!accessToken) throw new PublisherError("The connected Instagram access token is missing.", { code: "meta_page_token_missing" });

    if (input.media.length > 1) {
      const childIds: string[] = [];
      for (const media of input.media) {
        childIds.push(await createInstagramImageContainer(base, igId, accessToken, media.url, true));
      }

      for (const childId of childIds) await waitForInstagramContainer(base, childId, accessToken);

      const carouselBody = new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: input.content,
        access_token: accessToken,
      });
      const carouselResponse = await providerFetch(`${base}/${igId}/media`, {
        method: "POST",
        body: carouselBody,
      });
      const carousel = await carouselResponse.json() as { id?: string };
      if (!carousel.id) throw new PublisherError("Instagram did not return a carousel container ID.", { code: "missing_container_id" });

      await waitForInstagramContainer(base, carousel.id, accessToken);
      const publishResponse = await providerFetch(`${base}/${igId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: carousel.id, access_token: accessToken }),
      });
      const result = await publishResponse.json() as { id?: string };
      if (!result.id) throw new PublisherError("Instagram published the carousel but did not return a media ID.", { code: "missing_post_id" });
      return { platformPostId: result.id };
    }

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

    await waitForInstagramContainer(base, container.id, accessToken);

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
