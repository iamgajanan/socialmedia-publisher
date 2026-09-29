import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import { parsePostListQuery } from "@/lib/api/post-management-core";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const parsed = parsePostListQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const { status, platform, from, to, limit, offset } = parsed.data;
  const admin = createAdminClient();

  let matchingPostIds: string[] | null = null;
  if (platform) {
    const { data: links, error: linksError } = await admin
      .from("socialmedia_post_platforms")
      .select("post_id")
      .eq("platform", platform);

    if (linksError) {
      console.error("api_posts_platform_filter_failed", {
        profileId: authentication.profileId,
        platform,
        code: linksError.code,
        message: linksError.message,
      });
      return NextResponse.json({ error: "Unable to filter posts." }, { status: 500 });
    }

    matchingPostIds = [...new Set((links ?? []).map((link) => String(link.post_id)))];
    if (!matchingPostIds.length) {
      return NextResponse.json({ success: true, posts: [], count: 0, limit, offset });
    }
  }

  let query = admin
    .from("socialmedia_posts")
    .select("id,profile_id,status,content,media_urls,scheduled_at,published_at,created_at,updated_at", { count: "exact" })
    .eq("profile_id", authentication.profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (matchingPostIds) query = query.in("id", matchingPostIds);
  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lt("scheduled_at", to);

  const { data: posts, error: postsError, count } = await query;
  if (postsError) {
    console.error("api_posts_list_failed", {
      profileId: authentication.profileId,
      code: postsError.code,
      message: postsError.message,
    });
    return NextResponse.json({ error: "Unable to load posts." }, { status: 500 });
  }

  const postIds = (posts ?? []).map((post) => post.id);
  const { data: links, error: linksError } = postIds.length
    ? await admin
        .from("socialmedia_post_platforms")
        .select("id,post_id,social_account_id,platform,status,platform_post_id,error_message,scheduled_at,published_at,retry_count,next_retry_at,last_attempt_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (linksError) {
    console.error("api_posts_destinations_failed", {
      profileId: authentication.profileId,
      code: linksError.code,
      message: linksError.message,
    });
    return NextResponse.json({ error: "Unable to load post destinations." }, { status: 500 });
  }

  const accountIds = [...new Set((links ?? []).map((link) => link.social_account_id).filter((id): id is string => Boolean(id)))];
  const { data: accounts } = accountIds.length
    ? await admin
        .from("socialmedia_social_accounts")
        .select("id,platform,account_name,username")
        .in("id", accountIds)
        .eq("profile_id", authentication.profileId)
    : { data: [] };

  const accountsById = new Map((accounts ?? []).map((account) => [account.id, account]));
  const linksByPost = new Map<string, typeof links>();
  for (const link of links ?? []) {
    const current = linksByPost.get(link.post_id) ?? [];
    current.push(link);
    linksByPost.set(link.post_id, current);
  }

  return NextResponse.json({
    success: true,
    posts: (posts ?? []).map((post) => ({
      id: post.id,
      status: post.status,
      content: post.content,
      media_paths: Array.isArray(post.media_urls) ? post.media_urls : [],
      scheduled_at: post.scheduled_at,
      published_at: post.published_at,
      created_at: post.created_at,
      updated_at: post.updated_at,
      results: (linksByPost.get(post.id) ?? []).map((link) => {
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
    })),
    count: count ?? 0,
    limit,
    offset,
  });
}
