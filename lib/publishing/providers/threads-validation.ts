type ThreadsValidationInput = {
  content: string;
  media: Array<{ mimeType: string }>;
};

export function validateThreadsPublishInput(input: ThreadsValidationInput) {
  if (!input.content.trim() && input.media.length === 0) {
    throw new Error("Threads posts need text or supported media.");
  }
  if (input.content.length > 500) {
    throw new Error("Threads content exceeds 500 characters.");
  }
  if (input.media.length > 1) {
    throw new Error("Threads publishing currently supports one media asset per destination.");
  }
  if (input.media.length > 0 && !/^(image|video)\//.test(input.media[0].mimeType)) {
    throw new Error("Threads supports image and video media in this integration.");
  }
}
