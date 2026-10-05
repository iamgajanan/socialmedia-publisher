import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import {
  API_MEDIA_MAX_BYTES,
  isSupportedApiMediaType,
  sanitizeMediaFilename,
} from "@/lib/api/media-upload-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";

const BUCKET = "social-media-assets";

async function POSTImpl(request: Request) {
  const requestId = getRequestId(request);
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
  if (contentLength > API_MEDIA_MAX_BYTES + 1024 * 1024) {
    return apiJson({ error: "The upload exceeds the 100 MB size limit.", code: "media_too_large" }, 413, requestId);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiJson({ error: "Request body must be multipart/form-data.", code: "invalid_multipart_body" }, 400, requestId);
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return apiJson({ error: "A media file is required in the 'file' field.", code: "media_file_required" }, 400, requestId);
  }

  if (!fileValue.size) return apiJson({ error: "The uploaded file is empty.", code: "empty_media" }, 400, requestId);
  if (fileValue.size > API_MEDIA_MAX_BYTES) {
    return apiJson({ error: "The upload exceeds the 100 MB size limit.", code: "media_too_large" }, 413, requestId);
  }

  const contentType = fileValue.type.trim().toLowerCase();
  if (!isSupportedApiMediaType(contentType)) {
    return apiJson({ error: "Unsupported media type.", code: "unsupported_media_type" }, 415, requestId);
  }

  const safeFilename = sanitizeMediaFilename(fileValue.name);
  const path = `${authentication.profileId}/${randomUUID()}-${safeFilename}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, await fileValue.arrayBuffer(), {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("api_media_upload_failed", {
      requestId,
      profileId: authentication.profileId,
      contentType,
      size: fileValue.size,
      message: error.message,
    });
    return apiJson({ error: "The media upload failed.", code: "media_upload_failed" }, 500, requestId);
  }

  return apiJson({
    success: true,
    media_path: path,
    filename: safeFilename,
    content_type: contentType,
    size: fileValue.size,
  }, 201, requestId);
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  return withRequestId(await POSTImpl(request), requestId);
}
