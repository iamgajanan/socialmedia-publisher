import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { getApiConnectedAccounts } from "@/lib/api/connected-accounts";
import { API_SOCIAL_PLATFORMS } from "@/lib/api/connected-accounts-core";
import { hashRequestBody, isValidIdempotencyKey, normalizeIdempotencyKey, API_JSON_BODY_MAX_BYTES } from "@/lib/api/idempotency";
import { getMissingPlatforms, parsePublishRequest } from "@/lib/api/publish-request";
import { buildIdempotencyKey } from "@/lib/publishing/idempotency";
import { mediaTypeFromPath, validateMediaSelection } from "@/lib/publishing/media-capabilities";

function apiJson(body: unknown, status: number, requestId: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return apiJson(
      { error: authentication.error },
      authentication.status,
      requestId,
      authentication.retryAfterSeconds ? { "Retry-After": String(authentication.retryAfterSeconds) } : undefined,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > API_JSON_BODY_MAX_BYTES) {
    return apiJson({ error: "Request body exceeds the 1 MB limit." }, 413, requestId);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > API_JSON_BODY_MAX_BYTES) {
    return apiJson({ error: "Request body exceeds the 1 MB limit." }, 413, requestId);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiJson({ error: "Request body must be valid JSON." }, 400, requestId);
  }

  const parsed = parsePublishRequest(body);
  if (!parsed.ok) return apiJson({ error: parsed.message }, 400, requestId);

  const { platforms, text, media_paths: mediaPaths, scheduled_at: requestedScheduledAt } = parsed.data;

  const unsupported = platforms.filter((platform) => !API_SOCIAL_PLATFORMS.includes(platform));
  if (unsupported.length) {
    return apiJson({ error: `Unsupported platform: ${unsupported.join(", ")}.` }, 400, requestId);
  }

  const idempotencyHeader = request.headers.get("idempotency-key");
  const idempotencyKey = idempotencyHeader ? normalizeIdempotencyKey(idempotencyHeader) : null;
  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    return apiJson({
      error: "Idempotency-Key must be 1-128 characters and contain only letters, numbers, ., _, ~, :, or -.",
    }, 400, requestId);
  }

  const admin = createAdminClient();
  const requestHash = hashRequestBody(rawBody);
  const { data: profileWorkspace } = await admin
    .from("socialmedia_profiles")
    .select("workspace_id")
    .eq("id", authentication.profileId)
    .maybeSingle();
  const workspaceId = profileWorkspace?.workspace_id ? String(profileWorkspace.workspace_id) : null;
  if (!workspaceId) return apiJson({ error: "Your workspace has not been initialized yet." }, 500, requestId);

  if (idempotencyKey) {
    const now = new Date().toISOString();
    await admin
      .from("socialmedia_api_idempotency_keys")
      .delete()
      .eq("api_key_id", authentication.apiKeyId)
      .eq("idempotency_key", idempotencyKey)
      .lt("expires_at", now);

    const { data: existing, error: existingError } = await admin
      .from("socialmedia_api_idempotency_keys")
      .select("request_hash,status,response_status,response_body")
      .eq("api_key_id", authentication.apiKeyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      console.error("api_publish_idempotency_lookup_failed", {
        requestId,
        profileId: authentication.profileId,
        code: existingError.code,
        message: existingError.message,
      });
      return apiJson({ error: "Unable to validate the idempotency key." }, 500, requestId);
    }

    if (existing) {
      if (existing.request_hash !== requestHash) {
        return apiJson({
          error: "Idempotency-Key was already used with a different request body.",
          code: "idempotency_key_reused",
        }, 409, requestId);
      }
      if (existing.status === "completed" && existing.response_body) {
        return apiJson(existing.response_body, Number(existing.response_status ?? 202), requestId);
      }
      return apiJson({
        error: "A request with this Idempotency-Key is already being processed.",
        code: "idempotency_key_in_progress",
      }, 409, requestId);
    }

    const { error: idempotencyInsertError } = await admin
      .from("socialmedia_api_idempotency_keys")
      .insert({
        api_key_id: authentication.apiKeyId,
        profile_id: authentication.profileId,
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        status: "processing",
      });

    if (idempotencyInsertError) {
      if (idempotencyInsertError.code === "23505") {
        return apiJson({
          error: "A request with this Idempotency-Key is already being processed.",
          code: "idempotency_key_in_progress",
        }, 409, requestId);
      }
      console.error("api_publish_idempotency_insert_failed", {
        requestId,
        profileId: authentication.profileId,
        code: idempotencyInsertError.code,
        message: idempotencyInsertError.message,
      });
      return apiJson({ error: "Unable to start the idempotent request." }, 500, requestId);
    }
  }

  const connectedResult = await getApiConnectedAccounts(authentication.profileId, platforms);
  if (connectedResult.error) {
    if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
    return apiJson({ error: connectedResult.error }, 500, requestId);
  }

  const missingPlatforms = getMissingPlatforms(
    platforms,
    connectedResult.accounts.map((account) => account.platform),
  );

  if (missingPlatforms.length === platforms.length) {
    if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
    return apiJson({
      error: "None of the requested platforms are connected.",
      code: "account_not_connected",
      platforms: missingPlatforms,
    }, 400, requestId);
  }

  const connectedPlatforms = connectedResult.accounts.map((account) => account.platform);
  if (mediaPaths.some((path) => !path.startsWith(`${authentication.profileId}/`) || path.includes(".."))) {
    if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
    return apiJson({ error: "One or more media files are not owned by your account." }, 400, requestId);
  }

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
        requestId,
        profileId: authentication.profileId,
        message: error.message,
      });
      if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
      return apiJson({ error: "The media could not be verified." }, 500, requestId);
    }

    ownedFiles = (data ?? []) as typeof ownedFiles;
    const ownedPaths = new Set(ownedFiles.map((file) => `${authentication.profileId}/${file.name}`));
    const missingMedia = mediaPaths.find((path) => !ownedPaths.has(path));
    if (missingMedia) {
      if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
      return apiJson({ error: "One or more selected media files could not be verified." }, 400, requestId);
    }

    const selectedFiles = mediaPaths.map((path) => ownedFiles.find((file) => `${authentication.profileId}/${file.name}` === path));
    const invalidSize = selectedFiles.find((file) => (file?.metadata?.size ?? 0) > 100 * 1024 * 1024);
    if (invalidSize) {
      if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
      return apiJson({ error: "One or more media files exceed the 100 MB size limit." }, 400, requestId);
    }

    const mediaTypes = selectedFiles.map((file, index) => String(file?.metadata?.mimetype ?? mediaTypeFromPath(mediaPaths[index] ?? "")));
    const mediaValidationError = validateMediaSelection(connectedPlatforms, mediaTypes);
    if (mediaValidationError) {
      if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
      return apiJson({ error: mediaValidationError }, 400, requestId);
    }
  } else {
    const mediaValidationError = validateMediaSelection(connectedPlatforms, []);
    if (mediaValidationError) {
      if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
      return apiJson({ error: mediaValidationError }, 400, requestId);
    }
  }

  const scheduledAt = requestedScheduledAt ?? new Date().toISOString();

  const { data: post, error: postError } = await admin
    .from("socialmedia_posts")
    .insert({
      profile_id: authentication.profileId,
      workspace_id: workspaceId,
      content: text,
      status: "scheduled",
      scheduled_at: scheduledAt,
      media_urls: mediaPaths,
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error("api_publish_post_create_failed", {
      requestId,
      profileId: authentication.profileId,
      code: postError?.code,
      message: postError?.message,
    });
    if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
    if (postError?.message === "POST_LIMIT_REACHED") {
      return apiJson({
        error: "Your Free plan allows 10 posts per rolling month. The limit resets one month after the first post in your current usage period. Upgrade your plan to publish more.",
        code: "post_limit_reached",
      }, 403, requestId);
    }
    return apiJson({ error: "Unable to create the post." }, 500, requestId);
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
      requestId,
      profileId: authentication.profileId,
      postId: post.id,
      code: destinationError.code,
      message: destinationError.message,
    });
    await admin.from("socialmedia_posts").delete().eq("id", post.id).eq("profile_id", authentication.profileId);
    await admin.rpc("socialmedia_release_post_usage", { p_workspace_id: workspaceId });
    if (idempotencyKey) await admin.from("socialmedia_api_idempotency_keys").delete().eq("api_key_id", authentication.apiKeyId).eq("idempotency_key", idempotencyKey);
    return apiJson({ error: "Unable to create publishing destinations." }, 500, requestId);
  }

  const isScheduled = Boolean(requestedScheduledAt);
  const responseBody = {
    success: true,
    post_id: post.id,
    scheduled_at: scheduledAt,
    results: destinations.map((destination) => ({
      platform: destination.platform,
      account_id: destination.social_account_id,
      status: destination.status === "skipped" ? "skipped" : isScheduled ? "scheduled" : "queued",
      ...(destination.status === "skipped" ? { reason: "account_not_connected" } : {}),
    })),
  };

  if (idempotencyKey) {
    const { error: idempotencyUpdateError } = await admin
      .from("socialmedia_api_idempotency_keys")
      .update({
        status: "completed",
        response_status: 202,
        response_body: responseBody,
      })
      .eq("api_key_id", authentication.apiKeyId)
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "processing");

    if (idempotencyUpdateError) {
      console.error("api_publish_idempotency_complete_failed", {
        requestId,
        profileId: authentication.profileId,
        postId: post.id,
        code: idempotencyUpdateError.code,
        message: idempotencyUpdateError.message,
      });
    }
  }

  return apiJson(responseBody, 202, requestId);
}
