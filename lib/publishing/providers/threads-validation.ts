import { PublisherError, type PublishInput } from "./types.ts";

export function validateThreadsPublishInput(input: Pick<PublishInput, "content" | "media">) {
  if (!input.content.trim() && input.media.length === 0) {
    throw new PublisherError("Threads posts need text or supported media.", { code: "empty_post" });
  }
  if (input.content.length > 500) {
    throw new PublisherError("Threads content exceeds 500 characters.", { code: "content_too_long" });
  }
  if (input.media.length > 1) {
    throw new PublisherError("Threads publishing currently supports one media asset per destination.", { code: "threads_media_count" });
  }
  if (input.media.length > 0 && !/^(image|video)\//.test(input.media[0].mimeType)) {
    throw new PublisherError("Threads supports image and video media in this integration.", { code: "threads_media_type" });
  }
}
