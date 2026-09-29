import { z } from "zod";
import { API_SOCIAL_PLATFORMS, type ApiSocialPlatform } from "./connected-accounts-core.ts";

export const API_PUBLISH_PLATFORMS = API_SOCIAL_PLATFORMS.filter(
  (platform): platform is Exclude<ApiSocialPlatform, "x"> => platform !== "x",
);

const publishPlatformSchema = z.enum(API_PUBLISH_PLATFORMS);

export const publishRequestSchema = z.object({
  platforms: z.array(publishPlatformSchema).min(1).max(API_PUBLISH_PLATFORMS.length),
  text: z.string().max(5000).default(""),
  media_paths: z.array(z.string().min(1).max(500)).max(20).default([]),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.text.trim() && value.media_paths.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["text"],
      message: "Provide text or at least one media file.",
    });
  }
  if (value.scheduled_at && new Date(value.scheduled_at).getTime() <= Date.now()) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduled_at"],
      message: "scheduled_at must be in the future.",
    });
  }
}).transform((value) => ({
  ...value,
  platforms: [...new Set(value.platforms)],
}));

export type ApiPublishRequest = z.infer<typeof publishRequestSchema>;

export function parsePublishRequest(input: unknown):
  | { ok: true; data: ApiPublishRequest }
  | { ok: false; message: string } {
  const parsed = publishRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    message: parsed.error.issues[0]?.message ?? "Invalid publish request.",
  };
}

export function getMissingPlatforms(
  requestedPlatforms: ApiSocialPlatform[],
  connectedPlatforms: ApiSocialPlatform[],
): ApiSocialPlatform[] {
  const connected = new Set(connectedPlatforms);
  return requestedPlatforms.filter((platform) => !connected.has(platform));
}
