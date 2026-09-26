import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 10;

export type PublishingWorkerResult = {
  scanned: number;
  deferred: number;
  claimed: number;
};

export async function runPublishingWorker(): Promise<PublishingWorkerResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: duePosts, error } = await supabase
    .from("socialmedia_posts")
    .select("id, scheduled_at")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Unable to load scheduled posts: ${error.message}`);

  let claimed = 0;
  let deferred = 0;

  for (const post of duePosts ?? []) {
    if (!post.scheduled_at) continue;

    const { data: claimedPost, error: claimError } = await supabase
      .from("socialmedia_posts")
      .update({ status: "publishing" })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .eq("scheduled_at", post.scheduled_at)
      .select("id")
      .maybeSingle();

    if (claimError || !claimedPost) continue;
    claimed += 1;

    const { error: platformError } = await supabase
      .from("socialmedia_post_platforms")
      .update({ status: "publishing" })
      .eq("post_id", post.id)
      .eq("status", "scheduled");

    if (platformError) {
      await supabase.from("socialmedia_posts").update({ status: "scheduled" }).eq("id", post.id).eq("status", "publishing");
      continue;
    }

    // Provider adapters are intentionally introduced in Phase 10.
    // Until then, release the claim so a scheduled post is never stranded.
    await supabase
      .from("socialmedia_post_platforms")
      .update({ status: "scheduled" })
      .eq("post_id", post.id)
      .eq("status", "publishing");

    await supabase
      .from("socialmedia_posts")
      .update({ status: "scheduled" })
      .eq("id", post.id)
      .eq("status", "publishing");

    deferred += 1;
  }

  return { scanned: duePosts?.length ?? 0, deferred, claimed };
}
