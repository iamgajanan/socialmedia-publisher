import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";

const THREADS_GRAPH_URL = "https://graph.threads.net/v1.0";

export const threadsPublisher: Publisher = {
  platform: "threads",

  validate(input) {
    if (!input.content.trim() && input.media.length === 0) {
      throw new PublisherError("Threads posts need text or supported media.", { code: "empty_post" });
    }
    if (input.content.length > 500) {
      throw new PublisherError("Threads content exceeds 500 characters.", { code: "content_too_long" });
    }
    if (input.media.length > 0) {
      throw new PublisherError("Threads media publishing is not enabled in this first integration; text publishing is supported.", { code: "threads_media_not_configured" });
    }
  },

  async publish(input, accessToken) {
    const userId = input.account.external_account_id;
    const createBody = new URLSearchParams();
    createBody.set("media_type", "TEXT");
    if (input.content.trim()) createBody.set("text", input.content);

    const containerResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: createBody,
    });
    const container = await containerResponse.json() as { id?: string };
    if (!container.id) {
      throw new PublisherError("Threads accepted the container request but did not return a creation ID.", { code: "missing_creation_id" });
    }

    const publishBody = new URLSearchParams({ creation_id: container.id });
    const publishResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads_publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: publishBody,
    });
    const published = await publishResponse.json() as { id?: string };
    if (!published.id) {
      throw new PublisherError("Threads published the post but did not return a post ID.", { code: "missing_post_id" });
    }
    return { platformPostId: published.id };
  },

  async getAccount(accessToken) {
    const response = await providerFetch(`${THREADS_GRAPH_URL}/me?fields=id,username,name,threads_profile_picture_url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { id?: string; username?: string; name?: string; threads_profile_picture_url?: string };
    return {
      external_account_id: data.id,
      account_name: data.name || data.username,
      username: data.username,
      avatar_url: data.threads_profile_picture_url,
    };
  },
};
