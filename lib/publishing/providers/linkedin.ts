import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type MediaAsset, type Publisher } from "./types";

const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION?.trim() || "202609";
const LINKEDIN_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const LINKEDIN_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const VIDEO_CHUNK_SIZE = 4 * 1024 * 1024;

type LinkedInUploadInstruction = {
  uploadUrl: string;
  firstByte: number;
  lastByte: number;
};

function authorUrn(input: Parameters<Publisher["validate"]>[0]) {
  return input.account.metadata.linkedin_author_urn
    ? String(input.account.metadata.linkedin_author_urn)
    : `urn:li:person:${input.account.external_account_id}`;
}

async function downloadMedia(media: MediaAsset) {
  const response = await fetch(media.url, { cache: "no-store" });
  if (!response.ok) {
    throw new PublisherError(
      `The stored LinkedIn media could not be downloaded (${response.status}).`,
      { retryable: true, code: "media_download_failed" },
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) {
    throw new PublisherError("The LinkedIn media file is empty.", { code: "media_empty" });
  }
  return bytes;
}

async function uploadImage(media: MediaAsset, accessToken: string, owner: string) {
  const registration = await providerFetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    },
  );
  const registrationBody = await registration.json() as {
    value?: { uploadUrl?: string; image?: string };
  };
  const uploadUrl = registrationBody.value?.uploadUrl;
  const imageUrn = registrationBody.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new PublisherError("LinkedIn did not return an image upload URL.", { code: "linkedin_image_upload_init_failed" });
  }

  const bytes = await downloadMedia(media);
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });
  if (!upload.ok) {
    throw new PublisherError(`LinkedIn image upload failed (${upload.status}).`, {
      retryable: upload.status === 408 || upload.status === 429 || upload.status >= 500,
      code: `linkedin_image_upload_${upload.status}`,
    });
  }

  return imageUrn;
}

async function uploadVideo(media: MediaAsset, accessToken: string, owner: string) {
  const bytes = await downloadMedia(media);
  const registration = await providerFetch(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner,
          fileSizeBytes: bytes.byteLength,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    },
  );
  const registrationBody = await registration.json() as {
    value?: {
      video?: string;
      uploadToken?: string;
      uploadInstructions?: LinkedInUploadInstruction[];
    };
  };
  const videoUrn = registrationBody.value?.video;
  const uploadToken = registrationBody.value?.uploadToken ?? "";
  const instructions = [...(registrationBody.value?.uploadInstructions ?? [])].sort(
    (a, b) => a.firstByte - b.firstByte,
  );

  if (!videoUrn || !instructions.length) {
    throw new PublisherError("LinkedIn did not return video upload instructions.", {
      code: "linkedin_video_upload_init_failed",
    });
  }

  const uploadedPartIds: string[] = [];
  let expectedFirstByte = 0;

  for (const instruction of instructions) {
    if (
      !instruction.uploadUrl ||
      !Number.isInteger(instruction.firstByte) ||
      !Number.isInteger(instruction.lastByte) ||
      instruction.firstByte !== expectedFirstByte ||
      instruction.lastByte < instruction.firstByte ||
      instruction.lastByte >= bytes.byteLength
    ) {
      throw new PublisherError("LinkedIn returned invalid video upload instructions.", {
        code: "linkedin_video_upload_instructions_invalid",
      });
    }

    const chunk = bytes.slice(instruction.firstByte, instruction.lastByte + 1);
    if (chunk.byteLength > VIDEO_CHUNK_SIZE) {
      throw new PublisherError("LinkedIn returned an unsupported video chunk size.", {
        code: "linkedin_video_chunk_too_large",
      });
    }

    const upload = await fetch(instruction.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunk,
    });
    if (!upload.ok) {
      throw new PublisherError(`LinkedIn video upload failed (${upload.status}).`, {
        retryable: upload.status === 408 || upload.status === 429 || upload.status >= 500,
        code: `linkedin_video_upload_${upload.status}`,
      });
    }

    const etag = upload.headers.get("etag")?.replace(/^"|"$/g, "").trim();
    if (!etag) {
      throw new PublisherError("LinkedIn did not return an ETag for a video upload part.", {
        retryable: true,
        code: "linkedin_video_missing_etag",
      });
    }
    uploadedPartIds.push(etag);
    expectedFirstByte = instruction.lastByte + 1;
  }

  if (expectedFirstByte !== bytes.byteLength) {
    throw new PublisherError("LinkedIn video upload instructions did not cover the complete file.", {
      code: "linkedin_video_upload_incomplete",
    });
  }

  await providerFetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": LINKEDIN_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken,
        uploadedPartIds,
      },
    }),
  });

  return videoUrn;
}

export const linkedinPublisher: Publisher = {
  platform: "linkedin",
  validate(input) {
    if (!input.content.trim() && input.media.length === 0) {
      throw new PublisherError("LinkedIn posts need text or supported media.", { code: "empty_post" });
    }
    if (input.media.length > 1) {
      throw new PublisherError("LinkedIn supports one image or video per post in OmniSocial.", { code: "too_many_media" });
    }
    if (input.media.length === 1) {
      const mimeType = input.media[0].mimeType.toLowerCase();
      if (!LINKEDIN_IMAGE_TYPES.has(mimeType) && !LINKEDIN_VIDEO_TYPES.has(mimeType)) {
        throw new PublisherError("LinkedIn supports JPEG/PNG images and MP4/MOV videos.", { code: "unsupported_media_type" });
      }
    }
    if (input.content.length > 3000) {
      throw new PublisherError("LinkedIn content exceeds the 3,000 character limit.", { code: "content_too_long" });
    }
  },
  async publish(input, accessToken) {
    const author = authorUrn(input);

    if (input.media.length === 0) {
      const response = await providerFetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Linkedin-Version": LINKEDIN_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author,
          commentary: input.content,
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      });
      const id = response.headers.get("x-restli-id");
      if (!id) throw new PublisherError("LinkedIn published the post but did not return a post ID.", { code: "missing_post_id" });
      return { platformPostId: id };
    }

    const media = input.media[0];
    const mediaId = media.mimeType.startsWith("image/")
      ? await uploadImage(media, accessToken, author)
      : await uploadVideo(media, accessToken, author);

    const response = await providerFetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author,
        commentary: input.content,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { id: mediaId } },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    const id = response.headers.get("x-restli-id");
    if (!id) throw new PublisherError("LinkedIn published the media post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: id };
  },
  async getAccount(accessToken) {
    const response = await providerFetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as Record<string, unknown>;
    return { external_account_id: String(data.sub ?? ""), account_name: typeof data.name === "string" ? data.name : undefined };
  },
};
