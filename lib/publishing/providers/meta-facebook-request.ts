export type FacebookPublishRequest = {
  url: string;
  body: URLSearchParams;
};

export function buildFacebookPublishRequest(
  graphVersion: string,
  pageId: string,
  pageToken: string,
  content: string,
  media?: { url: string; mimeType: string },
): FacebookPublishRequest {
  if (!graphVersion.trim()) throw new Error("Facebook Graph API version is required.");
  if (!pageId.trim()) throw new Error("Facebook Page ID is required.");
  if (!pageToken.trim()) throw new Error("Facebook Page access token is required.");

  const isImage = media?.mimeType.startsWith("image/") ?? false;
  const endpoint = !media ? "feed" : isImage ? "photos" : "videos";
  const body = new URLSearchParams({ access_token: pageToken });

  if (!media) {
    body.set("message", content);
  } else if (isImage) {
    body.set("url", media.url);
    body.set("caption", content);
  } else {
    body.set("file_url", media.url);
    body.set("description", content);
  }

  return {
    url: `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/${endpoint}`,
    body,
  };
}
