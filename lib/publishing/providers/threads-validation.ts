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
  if (input.media.length > 20) {
    throw new Error("Threads carousel posts support at most 20 media items.");
  }
  if (input.media.length > 1 && input.media.length < 2) {
    throw new Error("Threads carousels require at least two media items.");
  }
  if (input.media.length > 1 && input.media.some((media) => !/^(image\\/(jpeg|png)|video\\/(mp4|quicktime))$/.test(media.mimeType))) {
    throw new Error("Threads carousels support JPEG/PNG images and MP4/MOV videos.");
  }
  if (input.media.length > 0 && !/^(image|video)\//.test(input.media[0].mimeType)) {
    throw new Error("Threads supports image and video media in this integration.");
  }
}
