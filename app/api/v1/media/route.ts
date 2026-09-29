import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { authenticateApiRequest } from "@/lib/api/api-auth";
import {
  API_MEDIA_MAX_BYTES,
  isSupportedApiMediaType,
  sanitizeMediaFilename,
} from "@/lib/api/media-upload-core";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "social-media-assets";

export async function POST(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > API_MEDIA_MAX_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "The upload exceeds the 100 MB size limit." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Request body must be multipart/form-data." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "A media file is required in the 'file' field." }, { status: 400 });
  }

  if (!fileValue.size) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  if (fileValue.size > API_MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "The upload exceeds the 100 MB size limit." }, { status: 413 });
  }

  const contentType = fileValue.type.trim().toLowerCase();
  if (!isSupportedApiMediaType(contentType)) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
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
      profileId: authentication.profileId,
      contentType,
      size: fileValue.size,
      message: error.message,
    });
    return NextResponse.json({ error: "The media upload failed." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    media_path: path,
    filename: safeFilename,
    content_type: contentType,
    size: fileValue.size,
  }, { status: 201 });
}
