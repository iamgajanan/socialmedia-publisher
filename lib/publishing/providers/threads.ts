import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";
import { validateThreadsPublishInput } from "./threads-validation";

const THREADS_GRAPH_URL = "https://graph.threads.net/v1.0";
const THREADS_CONTAINER_MAX_ATTEMPTS = 24;
const THREADS_CONTAINER_POLL_MS = 2500;

async function waitForThreadsContainer(
  containerId: string,
  accessToken: string,
): Promise<void> {
  for (let attempt = 0; attempt < THREADS_CONTAINER_MAX_ATTEMPTS; attempt += 1) {
    const statusResponse = await providerFetch(
      `${THREADS_GRAPH_URL}/${encodeURIComponent(containerId)}?fields=id,status,error_message`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const status = await statusResponse.json() as {
      status?: string;
      error_message?: string;
    };

    if (status.status === "FINISHED") return;

    if (status.status === "ERROR") {
      throw new PublisherError(
        status.error_message || "Threads media processing failed.",
        { code: "threads_media_processing_failed" },
      );
    }

    if (status.status === "EXPIRED") {
      throw new PublisherError(
        "Threads media container expired before publishing.",
        {
          retryable: true,
          code: "threads_container_expired",
        },
      );
    }

    if (attempt < THREADS_CONTAINER_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, THREADS_CONTAINER_POLL_MS),
      );
    }
  }

  throw new PublisherError(
    "Threads media is still processing; retry later.",
    {
      retryable: true,
      code: "threads_media_processing",
    },
  );
}

export const threadsPublisher: Publisher = {
  platform: "threads",
  validate(input) {
    validateThreadsPublishInput(input);
  },
  async publish(input, accessToken) {
    const userId = input.account.external_account_id;
    if (!userId) throw new PublisherError("The connected Threads user ID is missing.", { code: "threads_user_not_found" });
    const createContainer = async (media?: { url: string; mimeType: string }, carouselItem = false) => {
      const body = new URLSearchParams();
      if (!media) {
        body.set("media_type", "TEXT");
        body.set("text", input.content);
      } else {
        const isVideo = media.mimeType.startsWith("video/");
        body.set("media_type", isVideo ? "VIDEO" : "IMAGE");
        body.set(isVideo ? "video_url" : "image_url", media.url);
        if (carouselItem) body.set("is_carousel_item", "true");
        if (!carouselItem && input.content.trim()) body.set("text", input.content);
      }
      const response = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const result = await response.json() as { id?: string };
      if (!result.id) throw new PublisherError("Threads did not return a media container ID.", { code: "missing_creation_id" });
      return result.id;
    };

    let creationId: string;
    if (input.media.length > 1) {
      const childIds: string[] = [];
      for (const media of input.media) {
        childIds.push(await createContainer(media, true));
      }
      for (const childId of childIds) await waitForThreadsContainer(childId, accessToken);
      const carouselResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "CAROUSEL",
          children: childIds.join(","),
          ...(input.content.trim() ? { text: input.content } : {}),
        }),
      });
      const carousel = await carouselResponse.json() as { id?: string };
      if (!carousel.id) throw new PublisherError("Threads did not return a carousel container ID.", { code: "missing_creation_id" });
      creationId = carousel.id;
    } else {
      creationId = await createContainer(input.media[0]);
    }

    await waitForThreadsContainer(creationId, accessToken);
    const publishResponse = await providerFetch(`${THREADS_GRAPH_URL}/${encodeURIComponent(userId)}/threads_publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId }),
    });
    const published = await publishResponse.json() as { id?: string };
    if (!published.id) throw new PublisherError("Threads published the post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: published.id };
  },
  async refreshAccessToken(_account, accessToken) {
    const response = await providerFetch(
      "https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = await response.json() as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new PublisherError(
        "Threads did not return a refreshed access token.",
        { code: "threads_refresh_failed" },
      );
    }
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  },
  async getAccount(accessToken) {
    const response = await providerFetch(
      `${THREADS_GRAPH_URL}/me?fields=id,username,name,threads_profile_picture_url`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = await response.json() as {
      id?: string;
      username?: string;
      name?: string;
      threads_profile_picture_url?: string;
    };
    return {
      external_account_id: data.id,
      account_name: data.name || data.username,
      username: data.username,
      avatar_url: data.threads_profile_picture_url,
    };
  },
};
