export type MediaKind = "image" | "video";
export type MediaCapability = { minFiles: number; maxFiles: number; imageTypes: string[]; videoTypes: string[] };
const ALL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp"];
const ALL_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const LINKEDIN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LINKEDIN_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export const PLATFORM_MEDIA_CAPABILITIES: Record<string, MediaCapability> = {
  facebook: { minFiles: 0, maxFiles: 1, imageTypes: ALL_IMAGE_TYPES, videoTypes: ALL_VIDEO_TYPES },
  instagram: { minFiles: 1, maxFiles: 1, imageTypes: ALL_IMAGE_TYPES, videoTypes: ["video/mp4", "video/quicktime"] },
  threads: { minFiles: 0, maxFiles: 1, imageTypes: ["image/jpeg", "image/png"], videoTypes: ["video/mp4", "video/quicktime"] },
  youtube: { minFiles: 1, maxFiles: 1, imageTypes: [], videoTypes: ALL_VIDEO_TYPES },
  tiktok: { minFiles: 1, maxFiles: 1, imageTypes: [], videoTypes: ["video/mp4", "video/quicktime"] },
  // LinkedIn supports text-only posts as well as image/video shares.
  linkedin: { minFiles: 0, maxFiles: 1, imageTypes: LINKEDIN_IMAGE_TYPES, videoTypes: LINKEDIN_VIDEO_TYPES },
  x: { minFiles: 0, maxFiles: 0, imageTypes: [], videoTypes: [] },
};
const DEFAULT_CAPABILITY: MediaCapability = { minFiles: 0, maxFiles: 20, imageTypes: ALL_IMAGE_TYPES, videoTypes: ALL_VIDEO_TYPES };
function intersect(values: string[][]): string[] { return values.length ? values.reduce((current, next) => current.filter((value) => next.includes(value))) : []; }
export function getMediaCapability(platforms: string[]): MediaCapability {
  const capabilities = platforms.map((platform) => PLATFORM_MEDIA_CAPABILITIES[platform] ?? DEFAULT_CAPABILITY);
  if (!capabilities.length) return DEFAULT_CAPABILITY;
  return { minFiles: Math.max(...capabilities.map((c) => c.minFiles)), maxFiles: Math.min(...capabilities.map((c) => c.maxFiles)), imageTypes: intersect(capabilities.map((c) => c.imageTypes)), videoTypes: intersect(capabilities.map((c) => c.videoTypes)) };
}
export function mediaTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  return "application/octet-stream";
}
export function validateMediaSelection(platforms: string[], mediaTypes: string[]): string | null {
  const capability = getMediaCapability(platforms);
  if (mediaTypes.length < capability.minFiles) {
    const needsVideo = capability.videoTypes.length > 0 && capability.imageTypes.length === 0;
    return `${platforms.join(" and ")} requires at least ${capability.minFiles} ${needsVideo ? "video" : "image or video"}.`;
  }
  if (mediaTypes.length > capability.maxFiles) return `${platforms.join(" and ")} supports at most ${capability.maxFiles} media file${capability.maxFiles === 1 ? "" : "s"} per post.`;
  for (const type of mediaTypes) if (!capability.imageTypes.includes(type) && !capability.videoTypes.includes(type)) return `${type} is not supported by the selected destination${platforms.length === 1 ? "" : "s"}.`;
  return null;
}
