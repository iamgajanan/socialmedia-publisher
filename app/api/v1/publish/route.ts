import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { getApiConnectedAccounts } from "@/lib/api/connected-accounts";
import { API_SOCIAL_PLATFORMS } from "@/lib/api/connected-accounts-core";
import { getMissingPlatforms, parsePublishRequest } from "@/lib/api/publish-request";
import { buildIdempotencyKey } from "@/lib/publishing/idempotency";
import { mediaTypeFromPath, validateMediaSelection } from "@/lib/publishing/media-capabilities";

export async function POST(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parsePublishRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const { platforms, text, media_paths: mediaPaths, scheduled_at: requestedScheduledAt } = parsed.data;

  const unsupported = platforms.filter((platform) => !API_SOCIAL_PLATFORMS.includes(platform));
  if (unsupported.length) {
    return NextResponse.json({ error: `Unsupported platform: ${unsupported.join(", ")}.` }, { status: 400 });
  }

  const connectedResult = await getApiConnectedAccounts(authentication.profileId, platforms);
  if (connectedResult.error) {
    return NextResponse.json({ error: connectedResult.error }, { status: 500 });
  }

  const missingPlatforms = getMissingPlatforms(
    platforms,
    connectedResult.accounts.map((account) => account.platform),
  );

  if (missingPlatforms.length === platforms.length) {
    return NextResponse.json({
      error: "None of the requested platforms are connected.",
      code: "account_not_connected",
      platforms: missingPlatforms,
    }, { status: 400 });
  }

  const connectedPlatforms = connectedResult.accounts.map((account) => account.platform);
  if (mediaPaths.some((path) => !path.startsWith(`${authentication.profileId}/`) || path.includes(".."))) {
    return NextResponse.json({ error: "One or more media files are not owned by your account." }, { status: 400 });
  }

  const admin = createAdminClient();
  let ownedFiles: { name: string; metadata?: { mimetype?: string; size?: number } | null }[] = [];

  if (mediaPaths.length) {
    const { data, error } = await admin.storage
      .from("social-media-assets")
      .list(authentication.profileId, {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("api_publish_media_lookup_failed", {
        profileId: authentication.profileId,
        message: error.message,
      });
      return NextResponse.json({ error: "The media could not be verified." }, { status: 500 });
    }

    ownedFiles = (data ?? []) as typeof ownedFiles;
    const ownedPaths = new Set(ownedFiles.map((file) => `${authentication.profileId}/${file.name}`));
    const missingMedia = mediaPaths.find((path) => !ownedPaths.has(path));
    if (missingMedia) {
      return NextResponse.json({ error: "One or more selected media files could not be verified." }, { status: 400 });
    }

    const selectedFiles = mediaPaths.map((path) => ownedFiles.find((file) => `${authentication.profileId}/${file.name}` === path));
    const invalidSize = selectedFiles.find((file) => (file?.metadata?.size ?? 0) > 100 * 1024 * 1024);
    if (invalidSize) {
      return NextResponse.json({ error: "One or more media files exceed the 100 MB size limit." }, { status: 400 });
    }

    const mediaTypes = selectedFiles.map((file, index) => String(file?.metadata?.mimetype ?? mediaTypeFromPath(mediaPaths[index] ?? "")));
    const mediaValidationError = validateMediaSelection(connectedPlatforms, mediaTypes);
    if (mediaValidationError) return NextResponse.json({ error: mediaValidationError }, { status: 400 });
  } else {
    const mediaValidationError = validateMediaSelection(connectedPlatforms, []);
    if (mediaValidationError) return NextResponse.json({ error: mediaValidationError }, { status: 400 });
  }

  const scheduledAt = requestedScheduledAt ?? new Date().toISOString();

  const { data: post, error: postError } = await admin
    .from("socialmedia_posts")
    .insert({
      profile_id: authentication.profileId,
      content: text,
      status: "scheduled",
      scheduled_at: scheduledAt,
      media_urls: mediaPaths,
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error("api_publish_post_create_failed", {
      profileId: authentication.profileId,
      code: postError?.code,
      message: postError?.message,
    });
    return NextResponse.json({ error: "Unable to create the post." }, { status: 500 });
  }

  const connectedByPlatform = new Map(connectedResult.accounts.map((account) => [account.platform, account]));
  const destinations = platforms.map((platform) => {
    const account = connectedByPlatform.get(platform);
    if (!account) {
      return {
        post_id: post.id,
        social_account_id: null,
        platform,
        status: "skipped",
        error_message: "account_not_connected",
        scheduled_at: null,
        idempotency_key: null,
      };
    }

    return {
      post_id: post.id,
      social_account_id: account.id,
      platform,
      status: "scheduled",
      error_message: null,
      scheduled_at: scheduledAt,
      idempotency_key: buildIdempotencyKey(post.id, account.id),
    };
  });

  const { error: destinationError } = await admin
    .from("socialmedia_post_platforms")
    .insert(destinations);

  if (destinationError) {
    console.error("api_publish_destination_create_failed", {
      profileId: authentication.profileId,
      postId: post.id,
      code: destinationError.code,
      message: destinationError.message,
    });
    await admin.from("socialmedia_posts").delete().eq("id", post.id).eq("profile_id", authentication.profileId);
    return NextResponse.json({ error: "Unable to create publishing destinations." }, { status: 500 });
  }

  const isScheduled = Boolean(requestedScheduledAt);
  return NextResponse.json({
    success: true,
    post_id: post.id,
    scheduled_at: scheduledAt,
    results: destinations.map((destination) => ({
      platform: destination.platform,
      account_id: destination.social_account_id,
      status: destination.status === "skipped" ? "skipped" : isScheduled ? "scheduled" : "queued",
      ...(destination.status === "skipped" ? { reason: "account_not_connected" } : {}),
    })),
  }, { status: 202 });
}
