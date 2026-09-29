import { z } from "zod";
import { API_SOCIAL_PLATFORMS, type ApiSocialPlatform } from "./connected-accounts-core.ts";

const postStatuses = ["draft", "scheduled", "publishing", "published", "failed"] as const;

export const postListQuerySchema = z.object({
  status: z.enum(postStatuses).optional(),
  platform: z.enum(API_SOCIAL_PLATFORMS).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && new Date(value.from).getTime() >= new Date(value.to).getTime()) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "to must be later than from." });
  }
});

export type PostListQuery = z.infer<typeof postListQuerySchema>;

export const postManagementPatchSchema = z.object({
  content: z.string().max(5000).optional(),
  media_paths: z.array(z.string().min(1).max(500)).max(20).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.scheduled_at && new Date(value.scheduled_at).getTime() <= Date.now()) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduled_at"],
      message: "scheduled_at must be in the future.",
    });
  }
  if (value.content === undefined && value.media_paths === undefined && value.scheduled_at === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Provide at least one field to update.",
    });
  }
});

export type PostManagementPatch = z.infer<typeof postManagementPatchSchema>;

export function parsePostListQuery(searchParams: URLSearchParams):
  | { ok: true; data: PostListQuery }
  | { ok: false; message: string } {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = postListQuerySchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    message: parsed.error.issues[0]?.message ?? "Invalid post list query.",
  };
}

export function parsePostManagementPatch(input: unknown):
  | { ok: true; data: PostManagementPatch }
  | { ok: false; message: string } {
  const parsed = postManagementPatchSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    message: parsed.error.issues[0]?.message ?? "Invalid post update.",
  };
}

export function getEditablePostStatuses(): Array<"draft" | "scheduled"> {
  return ["draft", "scheduled"];
}

export function isApiSocialPlatform(value: string): value is ApiSocialPlatform {
  return (API_SOCIAL_PLATFORMS as readonly string[]).includes(value);
}
