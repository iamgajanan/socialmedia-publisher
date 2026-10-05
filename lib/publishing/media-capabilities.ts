export type MediaKind = "image" | "video";
export type MediaCapability = { minFiles: number; maxFiles: number; imageTypes: string[]; videoTypes: string[] };
export type PlatformMediaIssue = { platform: string; message: string };

const ALL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp"];
const ALL_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const LINKEDIN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LINKEDIN_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const PINTEREST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const PLATFORM_MEDIA_CAPABILITIES: Record<string, MediaCapability> = {
  facebook: { minFiles: 0, maxFiles: 1, imageTypes: ALL_IMAGE_TYPES, videoTypes: ALL_VIDEO_TYPES },
  instagram: { minFiles: 1, maxFiles: 10, imageTypes: ALL_IMAGE_TYPES, videoTypes: ["video/mp4", "video/quicktime"] },
  threads: { minFiles: 0, maxFiles: 1, imageTypes: ["image/jpeg", "image/png"], videoTypes: ["video/mp4", "video/quicktime"] },
  youtube: { minFiles: 1, maxFiles: 1, imageTypes: [], videoTypes: ALL_VIDEO_TYPES },
  tiktok: { minFiles: 1, maxFiles: 1, imageTypes: [], videoTypes: ["video/mp4", "video/quicktime"] },
  linkedin: { minFiles: 0, maxFiles: 1, imageTypes: LINKEDIN_IMAGE_TYPES, videoTypes: LINKEDIN_VIDEO_TYPES },
  x: { minFiles: 0, maxFiles: 0, imageTypes: [], videoTypes: [] },
  // The first Pinterest integration supports one standard image Pin. Video Pins
  // require Pinterest's asynchronous media-upload + cover-image flow and remain
  // intentionally unsupported until that flow is added.
  pinterest: { minFiles: 1, maxFiles: 1, imageTypes: PINTEREST_IMAGE_TYPES, videoTypes: [] },
};

const DEFAULT_CAPABILITY: MediaCapability = { minFiles: 0, maxFiles: 20, imageTypes: ALL_IMAGE_TYPES, videoTypes: ALL_VIDEO_TYPES };

function intersect(values: string[][]): string[] {
  return values.length ? values.reduce((current, next) => current.filter((value) => next.includes(value))) : [];
}

function union(values: string[][]): string[] {
  return [...new Set(values.flat())];
}

export function getMediaCapability(platforms: string[]): MediaCapability {
  const capabilities = platforms.map((platform) => PLATFORM_MEDIA_CAPABILITIES[platform] ?? DEFAULT_CAPABILITY);
  if (!capabilities.length) return DEFAULT_CAPABILITY;
  return {
    minFiles: Math.max(...capabilities.map((c) => c.minFiles)),
    maxFiles: Math.min(...capabilities.map((c) => c.maxFiles)),
    imageTypes: intersect(capabilities.map((c) => c.imageTypes)),
    videoTypes: intersect(capabilities.map((c) => c.videoTypes)),
  };
}

export function getUploadMediaCapability(platforms: string[]): MediaCapability {
  const capabilities = platforms.map((platform) => PLATFORM_MEDIA_CAPABILITIES[platform] ?? DEFAULT_CAPABILITY);
  if (!capabilities.length) return DEFAULT_CAPABILITY;
  return {
    minFiles: 0,
    maxFiles: Math.max(...capabilities.map((c) => c.maxFiles)),
    imageTypes: union(capabilities.map((c) => c.imageTypes)),
    videoTypes: union(capabilities.map((c) => c.videoTypes)),
  };
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

export function getPlatformMediaIssues(platforms: string[], mediaTypes: string[]): PlatformMediaIssue[] {
  if (!platforms.length || !mediaTypes.length) {
    return platforms.flatMap((platform) => {
      const capability = PLATFORM_MEDIA_CAPABILITIES[platform] ?? DEFAULT_CAPABILITY;
      if (capability.minFiles === 0) return [];
      return [{ platform, message: `${platform} requires media before publishing.` }];
    });
  }

  return platforms.flatMap((platform) => {
    const capability = PLATFORM_MEDIA_CAPABILITIES[platform] ?? DEFAULT_CAPABILITY;
    const issues: PlatformMediaIssue[] = [];

    if (mediaTypes.length > capability.maxFiles) {
      issues.push({
        platform,
        message: `${platform} supports at most ${capability.maxFiles} media file${capability.maxFiles === 1 ? "" : "s"} per post. Remove extra media or deselect ${platform}.`,
      });
      return issues;
    }

    if (platform === "youtube" && mediaTypes.some((type) => type.startsWith("image/"))) {
      issues.push({
        platform,
        message: "OmniSocial's current YouTube publishing integration supports video uploads only. Remove YouTube to publish this image post.",
      });
      return issues;
    }

    if (platform === "instagram" && mediaTypes.length > 1) {
      const hasImage = mediaTypes.some((type) => type.startsWith("image/"));
      const hasVideo = mediaTypes.some((type) => type.startsWith("video/"));
      if (hasImage && hasVideo) {
        issues.push({
          platform,
          message: "Instagram carousels cannot mix images and videos in the current publishing flow. Use only images or deselect Instagram.",
        });
        return issues;
      }
    }

    if (platform === "pinterest" && mediaTypes.some((type) => type.startsWith("video/"))) {
      issues.push({
        platform,
        message: "OmniSocial's current Pinterest integration supports image Pins only. Remove the video or deselect Pinterest.",
      });
      return issues;
    }

    const unsupported = mediaTypes.find(
      (type) => !capability.imageTypes.includes(type) && !capability.videoTypes.includes(type),
    );
    if (unsupported) {
      issues.push({
        platform,
        message: `${unsupported} is not supported by ${platform}. Remove that media or deselect ${platform}.`,
      });
    }

    return issues;
  });
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
