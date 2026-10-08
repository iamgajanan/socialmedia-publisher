import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import { parsePostManagementPatch } from "@/lib/api/post-management-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaTypeFromPath, validateMediaSelection } from "@/lib/publishing/media-capabilities";

type RouteContext = { params: Promise<{ postId: string }> };

async function loadPost(admin: ReturnType<typeof createAdminClient>, postId: string, profileId: string, workspaceId: string) {
  return admin
    .from("socialmedia_posts")
    .select("id,profile_id,status,content,media_urls,scheduled_at,published_at,created_at,updated_at")
    .eq("id", postId)
    .eq("profile_id", profileId)
    .maybeSingle();
}

async function loadResults(admin: ReturnType<typeof createAdminClient>, postId: string, profileId: string, workspaceId: string) {
  const { data: links, error: linksError } = await admin
    .from("socialmedia_post_platforms")
    .select("id,social_account_id,platform,status,platform_post_id,error_message,scheduled_at,published_at,retry_count,next_retry_at,last_attempt_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (linksError) return { error: linksError, results: [] };

  const accountIds = [...new Set((links ?? []).map((link) => link.social_account_id).filter((id): id is string => Boolean(id)))];
  const { data: accounts } = accountIds.length
    ? await admin
        .from("socialmedia_social_accounts")
        .select("id,platform,account_name,username")
        .in("id", accountIds)
        .eq("profile_id", profileId)
    : { data: [] };

  const accountsById = new Map((accounts ?? []).map((account) => [account.id, account]));

  return {
    error: null,
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
  };
}

export async function GET(request: Request, context: RouteContext) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const { postId } = await context.params;
  const admin = createAdminClient();
  const { data: post, error: postError } = await loadPost(admin, postId, authentication.profileId, authentication.workspaceId);

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

  const result = await loadResults(admin, post.id, authentication.profileId, authentication.workspaceId);
  if (result.error) {
    console.error("api_post_status_destinations_lookup_failed", {
      profileId: authentication.profileId,
      postId,
      code: result.error.code,
      message: result.error.message,
    });
    return NextResponse.json({ error: "Unable to load publishing results." }, { status: 500 });
  }

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
    results: result.results,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const { postId } = await context.params;
  const admin = createAdminClient();
  const { data: post, error: postError } = await loadPost(admin, postId, authentication.profileId);

  if (postError) return NextResponse.json({ error: "Unable to load the post." }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (!["draft", "scheduled"].includes(post.status)) {
    return NextResponse.json({
      error: "Only draft or scheduled posts can be edited.",
      code: "post_not_editable",
    }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parsePostManagementPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const { content, media_paths: mediaPaths, scheduled_at: scheduledAt } = parsed.data;

  const { data: links, error: linksError } = await admin
    .from("socialmedia_post_platforms")
    .select("social_account_id,platform,status")
    .eq("post_id", post.id);

  if (linksError) return NextResponse.json({ error: "Unable to load post destinations." }, { status: 500 });

  const activePlatforms = [...new Set(
    (links ?? [])
      .filter((link) => link.status !== "skipped")
      .map((link) => link.platform)
      .filter((platform): platform is string => Boolean(platform)),
  )];

  if (mediaPaths !== undefined) {
    if (mediaPaths.some((path) => !path.startsWith(`${authentication.profileId}/`) || path.includes(".."))) {
      return NextResponse.json({ error: "One or more media files are not owned by your account." }, { status: 400 });
    }

    let ownedFiles: { name: string; metadata?: { mimetype?: string; size?: number } | null }[] = [];
    if (mediaPaths.length) {
      const { data, error } = await admin.storage
        .from("social-media-assets")
        .list(authentication.profileId, {
          limit: 1000,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) return NextResponse.json({ error: "The media could not be verified." }, { status: 500 });
      ownedFiles = (data ?? []) as typeof ownedFiles;

      const ownedPaths = new Set(ownedFiles.map((file) => `${authentication.profileId}/${file.name}`));
      if (mediaPaths.some((path) => !ownedPaths.has(path))) {
        return NextResponse.json({ error: "One or more selected media files could not be verified." }, { status: 400 });
      }

      const selectedFiles = mediaPaths.map((path) =>
        ownedFiles.find((file) => `${authentication.profileId}/${file.name}` === path),
      );
      if (selectedFiles.some((file) => (file?.metadata?.size ?? 0) > 100 * 1024 * 1024)) {
        return NextResponse.json({ error: "One or more media files exceed the 100 MB size limit." }, { status: 400 });
      }

      const mediaTypes = selectedFiles.map((file, index) =>
        String(file?.metadata?.mimetype ?? mediaTypeFromPath(mediaPaths[index] ?? "")),
      );
      const mediaValidationError = validateMediaSelection(activePlatforms, mediaTypes);
      if (mediaValidationError) return NextResponse.json({ error: mediaValidationError }, { status: 400 });
    } else {
      const mediaValidationError = validateMediaSelection(activePlatforms, []);
      if (mediaValidationError) return NextResponse.json({ error: mediaValidationError }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  if (content !== undefined) update.content = content;
  if (mediaPaths !== undefined) update.media_urls = mediaPaths;
  if (scheduledAt !== undefined) update.scheduled_at = scheduledAt;
  if (post.status === "draft" && scheduledAt !== undefined) update.status = "scheduled";

  const { data: updatedPost, error: updateError } = await admin
    .from("socialmedia_posts")
    .update(update)
    .eq("id", post.id)
    .eq("profile_id", authentication.profileId)
    .in("status", ["draft", "scheduled"])
    .select("id,profile_id,status,content,media_urls,scheduled_at,published_at,created_at,updated_at")
    .maybeSingle();

  if (updateError) {
    console.error("api_post_update_failed", {
      profileId: authentication.profileId,
      postId,
      code: updateError.code,
      message: updateError.message,
    });
    return NextResponse.json({ error: "Unable to update the post." }, { status: 500 });
  }

  if (!updatedPost) return NextResponse.json({ error: "Post is no longer editable." }, { status: 409 });

  if (scheduledAt !== undefined || (post.status === "draft" && scheduledAt !== undefined)) {
    const destinationStatus = updatedPost.status === "scheduled" ? "scheduled" : "pending";
    const { error: destinationUpdateError } = await admin
      .from("socialmedia_post_platforms")
      .update({ scheduled_at: updatedPost.status === "scheduled" ? scheduledAt : null, status: destinationStatus })
      .eq("post_id", post.id)
      .neq("status", "skipped");

    if (destinationUpdateError) {
      console.error("api_post_destinations_update_failed", {
        profileId: authentication.profileId,
        postId,
        code: destinationUpdateError.code,
        message: destinationUpdateError.message,
      });
      return NextResponse.json({ error: "Unable to update publishing destinations." }, { status: 500 });
    }
  }

  const result = await loadResults(admin, post.id, authentication.profileId);
  if (result.error) return NextResponse.json({ error: "Unable to load updated post." }, { status: 500 });

  return NextResponse.json({
    success: true,
    post: {
      id: updatedPost.id,
      status: updatedPost.status,
      content: updatedPost.content,
      media_paths: Array.isArray(updatedPost.media_urls) ? updatedPost.media_urls : [],
      scheduled_at: updatedPost.scheduled_at,
      published_at: updatedPost.published_at,
      created_at: updatedPost.created_at,
      updated_at: updatedPost.updated_at,
    },
    results: result.results,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const { postId } = await context.params;
  const admin = createAdminClient();
  const { data: post, error: postError } = await loadPost(admin, postId, authentication.profileId);

  if (postError) return NextResponse.json({ error: "Unable to load the post." }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (post.status === "draft") {
    const { error } = await admin
      .from("socialmedia_posts")
      .delete()
      .eq("id", post.id)
      .eq("profile_id", authentication.profileId)
      .eq("status", "draft");

    if (error) return NextResponse.json({ error: "Unable to delete the draft." }, { status: 500 });
    return NextResponse.json({ success: true, action: "deleted", post_id: post.id });
  }

  if (post.status !== "scheduled") {
    return NextResponse.json({
      error: "Only draft or scheduled posts can be deleted or cancelled.",
      code: "post_not_cancellable",
    }, { status: 409 });
  }

  const { data: publishingLinks } = await admin
    .from("socialmedia_post_platforms")
    .select("id")
    .eq("post_id", post.id)
    .eq("status", "publishing")
    .limit(1);

  if (publishingLinks?.length) {
    return NextResponse.json({
      error: "The post is already publishing and cannot be cancelled.",
      code: "post_not_cancellable",
    }, { status: 409 });
  }

  const { error: destinationError } = await admin
    .from("socialmedia_post_platforms")
    .update({
      status: "skipped",
      error_message: "cancelled",
      scheduled_at: null,
    })
    .eq("post_id", post.id)
    .in("status", ["pending", "scheduled"]);

  if (destinationError) {
    console.error("api_post_cancel_destinations_failed", {
      profileId: authentication.profileId,
      postId,
      code: destinationError.code,
      message: destinationError.message,
    });
    return NextResponse.json({ error: "Unable to cancel publishing destinations." }, { status: 500 });
  }

  const { error: cancelError } = await admin
    .from("socialmedia_posts")
    .update({ status: "cancelled", scheduled_at: null })
    .eq("id", post.id)
    .eq("profile_id", authentication.profileId)
    .eq("status", "scheduled");

  if (cancelError) {
    console.error("api_post_cancel_failed", {
      profileId: authentication.profileId,
      postId,
      code: cancelError.code,
      message: cancelError.message,
    });
    return NextResponse.json({ error: "Unable to cancel the post." }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "cancelled", post_id: post.id });
}
