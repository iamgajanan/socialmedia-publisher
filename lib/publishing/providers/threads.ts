import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";
import { validateThreadsPublishInput } from "./threads-validation";

const THREADS_GRAPH_URL = "https://graph.threads.net/v1.0";

export const threadsPublisher: Publisher = {
  platform: "threads",
  validate(input) {
    validateThreadsPublishInput(input);
  },  async publish(input, accessToken) {
    const userId = input.account.external_account_id;
    const body = new URLSearchParams();
    if (!input.media.length) {
      body.set("media_type", "TEXT");
      body.set("text", input.content);
    } else {
      const media = input.media[0];
      body.set("media_type", media.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE");
      if (input.content.trim()) body.set("text", input.content);
      body.set(media.mimeType.startsWith("video/") ? "video_url" : "image_url", media.url);
    }
    const containerResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const container = await containerResponse.json() as { id?: string };
    if (!container.id) throw new PublisherError("Threads accepted the container request but did not return a creation ID.", { code: "missing_creation_id" });

    if (input.media[0]?.mimeType.startsWith("video/")) {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(container.id)}?fields=id,status,error_message`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const status = await statusResponse.json() as { status?: string; error_message?: string };
        if (status.status === "ERROR" || status.status === "EXPIRED") {
          throw new PublisherError(status.error_message || "Threads video processing failed.", { code: "threads_media_processing_failed" });
        }
        if (status.status === "FINISHED") break;
        if (attempt === 23) throw new PublisherError("Threads video is still processing; retry later.", { retryable: true, code: "threads_media_processing" });
      }
    }

    const publishResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads_publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: container.id }),
    });
    const published = await publishResponse.json() as { id?: string };
    if (!published.id) throw new PublisherError("Threads published the post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: published.id };
  },
  async refreshAccessToken(_account, accessToken) {
    const response = await providerFetch("https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new PublisherError("Threads did not return a refreshed access token.", { code: "threads_refresh_failed" });
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },
  async getAccount(accessToken) {
    const response = await providerFetch(`${THREADS_GRAPH_URL}/me?fields=id,username,name,threads_profile_picture_url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { id?: string; username?: string; name?: string; threads_profile_picture_url?: string };
    return { external_account_id: data.id, account_name: data.name || data.username, username: data.username, avatar_url: data.threads_profile_picture_url };
  },
};
