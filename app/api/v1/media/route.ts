import { randomUUID } from "node:crypto";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import {
  API_MEDIA_MAX_BYTES,
  detectApiMediaType,
  alignMediaFilenameWithType,
} from "@/lib/api/media-upload-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";

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
  if (contentLength > API_MEDIA_MAX_BYTES + 1024 * 1024) return apiJson({ error: "The upload exceeds the 100 MB size limit.", code: "media_too_large" }, 413, requestId);

  let formData: FormData;
  try { formData = await request.formData(); } catch { return apiJson({ error: "Request body must be multipart/form-data.", code: "invalid_multipart_body" }, 400, requestId); }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) return apiJson({ error: "A media file is required in the 'file' field.", code: "media_file_required" }, 400, requestId);
  if (!fileValue.size) return apiJson({ error: "The uploaded file is empty.", code: "empty_media" }, 400, requestId);
  if (fileValue.size > API_MEDIA_MAX_BYTES) return apiJson({ error: "The upload exceeds the 100 MB size limit.", code: "media_too_large" }, 413, requestId);

  const fileBytes = new Uint8Array(await fileValue.arrayBuffer());
  const contentType = detectApiMediaType(fileBytes, fileValue.name, fileValue.type);
  if (!contentType) {
    console.warn("api_media_upload_unsupported_content", {
      requestId,
      declaredContentType: fileValue.type,
      filename: fileValue.name,
      size: fileValue.size,
    });
    return apiJson({ error: "The uploaded file type could not be identified or is not supported.", code: "unsupported_media_type" }, 415, requestId);
  }

  if (fileValue.type.trim().toLowerCase() !== contentType) {
    console.info("api_media_upload_mime_corrected", {
      requestId,
      filename: fileValue.name,
      declaredContentType: fileValue.type,
      detectedContentType: contentType,
      size: fileValue.size,
    });
  }

  const safeFilename = alignMediaFilenameWithType(fileValue.name, contentType);
  if (safeFilename !== fileValue.name) {
    console.info("api_media_upload_filename_corrected", {
      requestId,
      originalFilename: fileValue.name,
      storedFilename: safeFilename,
      detectedContentType: contentType,
    });
  }
  const path = `${authentication.profileId}/${randomUUID()}-${safeFilename}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, fileBytes, { contentType, cacheControl: "3600", upsert: false });

  if (error) {
    console.error("api_media_upload_failed", { requestId, profileId: authentication.profileId, contentType, size: fileValue.size, message: error.message });
    return apiJson({ error: "The media upload failed.", code: "media_upload_failed" }, 500, requestId);
  }

  // Media upload is a best-effort webhook side effect. The asset is already persisted,
  // so a temporary webhook failure must not turn a successful upload into a 5xx response.
  try {
    await emitWebhookEvent(authentication.profileId, "media.uploaded", {
      media_path: path,
      filename: safeFilename,
      content_type: contentType,
      size: fileValue.size,
    });
  } catch (webhookError) {
    console.error("api_media_webhook_emit_failed", {
      requestId,
      profileId: authentication.profileId,
      message: webhookError instanceof Error ? webhookError.message : "Unknown webhook error",
    });
  }

  return apiJson({ success: true, media_path: path, filename: safeFilename, content_type: contentType, size: fileValue.size }, 201, requestId);
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  return withRequestId(await POSTImpl(request), requestId);
}
