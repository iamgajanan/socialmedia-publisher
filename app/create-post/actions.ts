"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const draftSchema = z.object({
  postId: z.string().uuid().optional(),
  content: z.string().max(5000),
  accountIds: z.array(z.string().uuid()).min(1, "Select at least one connected account."),
  mediaPaths: z.array(z.string().min(1)).max(20).default([]),
});

export type SaveDraftState = { ok: boolean; message: string; postId?: string };

export async function saveDraft(_previous: SaveDraftState, formData: FormData): Promise<SaveDraftState> {
  const rawAccountIds = formData.getAll("accountIds").filter((value): value is string => typeof value === "string");
  const rawMediaPaths = formData.getAll("mediaPaths").filter((value): value is string => typeof value === "string");
  const parsed = draftSchema.safeParse({
    postId: typeof formData.get("postId") === "string" && formData.get("postId") ? formData.get("postId") : undefined,
    content: String(formData.get("content") ?? ""),
    accountIds: rawAccountIds,
    mediaPaths: rawMediaPaths,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the post." };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/login");
  const userPathPrefix = `${String(userId)}/`;

  if (parsed.data.mediaPaths.some((path) => !path.startsWith(userPathPrefix) || path.includes(".."))) {
    return { ok: false, message: "One or more media files are not owned by your account." };
  }

  if (parsed.data.mediaPaths.length > 0) {
    const { data: ownedFiles, error: mediaError } = await supabase.storage
      .from("social-media-assets")
      .list(String(userId), { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (mediaError) return { ok: false, message: "The media could not be verified." };
    const ownedNames = new Set((ownedFiles ?? []).map((file) => `${userPathPrefix}${file.name}`));
    if (parsed.data.mediaPaths.some((path) => !ownedNames.has(path))) {
      return { ok: false, message: "One or more selected media files could not be verified." };
    }
  }

  const { data: accounts, error: accountError } = await supabase
    .from("socialmedia_social_accounts")
    .select("id")
    .eq("profile_id", String(userId))
    .eq("status", "connected")
    .in("id", parsed.data.accountIds);

  if (accountError || !accounts || accounts.length !== parsed.data.accountIds.length) {
    return { ok: false, message: "One or more selected accounts are no longer connected." };
  }

  let postId = parsed.data.postId;
  if (postId) {
    const { error } = await supabase.from("socialmedia_posts")
      .update({ content: parsed.data.content, status: "draft", scheduled_at: null, media_urls: parsed.data.mediaPaths })
      .eq("id", postId)
      .eq("profile_id", String(userId));
    if (error) return { ok: false, message: "The draft could not be updated." };
    const { error: deleteError } = await supabase.from("socialmedia_post_platforms").delete().eq("post_id", postId);
    if (deleteError) return { ok: false, message: "The draft changed, but its destinations could not be updated." };
  } else {
    const { data: post, error } = await supabase.from("socialmedia_posts")
      .insert({ profile_id: String(userId), content: parsed.data.content, status: "draft", media_urls: parsed.data.mediaPaths })
      .select("id")
      .single();
    if (error || !post) return { ok: false, message: "The draft could not be saved." };
    postId = post.id;
  }

  const { error: linksError } = await supabase.from("socialmedia_post_platforms").insert(
    parsed.data.accountIds.map((socialAccountId) => ({ post_id: postId, social_account_id: socialAccountId, status: "pending" })),
  );
  if (linksError) return { ok: false, message: "The draft was saved, but its destinations could not be saved." };

  revalidatePath("/create-post");
  revalidatePath("/dashboard");
  return { ok: true, message: "Draft saved.", postId };
}
