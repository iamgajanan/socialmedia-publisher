import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const { postId } = await context.params;
  const admin = createAdminClient();

  const { data: post, error: postError } = await admin
    .from("socialmedia_posts")
    .select("id,profile_id,status,content,media_urls,scheduled_at,published_at,created_at,updated_at")
    .eq("id", postId)
    .eq("profile_id", authentication.profileId)
    .maybeSingle();

  if (postError) {
    console.error("api_post_status_lookup_failed", {
      profileId: authentication.profileId,
      postId,
      code: postError.code,
      message: postError.message,
    });
    return NextResponse.json({ error: "Unable to load the post." }, { status: 500 });
  }

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const { data: links, error: linksError } = await admin
    .from("socialmedia_post_platforms")
    .select("id,social_account_id,platform,status,platform_post_id,error_message,scheduled_at,published_at,retry_count,next_retry_at,last_attempt_at,created_at")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });

  if (linksError) {
    console.error("api_post_status_destinations_lookup_failed", {
      profileId: authentication.profileId,
      postId,
      code: linksError.code,
      message: linksError.message,
    });
    return NextResponse.json({ error: "Unable to load publishing results." }, { status: 500 });
  }

  const accountIds = [...new Set((links ?? []).map((link) => link.social_account_id).filter((id): id is string => Boolean(id)))];
  const { data: accounts } = accountIds.length
    ? await admin.from("socialmedia_social_accounts").select("id,platform,account_name,username").in("id", accountIds).eq("profile_id", authentication.profileId)
    : { data: [] };

  const accountsById = new Map((accounts ?? []).map((account) => [account.id, account]));

  return NextResponse.json({
    success: true,
    post: {
      id: post.id,
      status: post.status,
      content: post.content,
      media_paths: Array.isArray(post.media_urls) ? post.media_urls : [],
      scheduled_at: post.scheduled_at,
      published_at: post.published_at,
      created_at: post.created_at,
      updated_at: post.updated_at,
    },
    results: (links ?? []).map((link) => {
      const account = link.social_account_id ? accountsById.get(link.social_account_id) : null;
      return {
        platform: link.platform ?? account?.platform ?? null,
        account_id: link.social_account_id,
        account_name: account?.account_name ?? null,
        username: account?.username ?? null,
        status: link.status,
        platform_post_id: link.platform_post_id,
        reason: link.status === "skipped" ? link.error_message : null,
        error: link.status === "failed" ? link.error_message : null,
        scheduled_at: link.scheduled_at,
        published_at: link.published_at,
        retry_count: link.retry_count,
        next_retry_at: link.next_retry_at,
        last_attempt_at: link.last_attempt_at,
      };
    }),
  });
}
