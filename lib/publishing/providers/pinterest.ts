import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type Publisher } from "./types";

const PINTEREST_API = "https://api.pinterest.com/v5";

function firstTitle(content: string) {
  return content.trim().split(/\r?\n/, 1)[0]?.slice(0, 100) || "OmniSocial Pin";
}

async function resolveBoardId(accessToken: string, accountMetadata: Record<string, unknown>) {
  const configured = typeof accountMetadata.pinterest_board_id === "string" ? accountMetadata.pinterest_board_id : "";
  if (configured) return configured;

  const boardsResponse = await providerFetch(`${PINTEREST_API}/boards?page_size=1`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const boards = await boardsResponse.json() as { items?: Array<{ id?: string }> };
  const boardId = boards.items?.[0]?.id;
  if (boardId) return boardId;

  const createResponse = await providerFetch(`${PINTEREST_API}/boards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: "OmniSocial", description: "Pins published from OmniSocial." }),
  });
  const created = await createResponse.json() as { id?: string };
  if (!created.id) throw new PublisherError("Pinterest did not return a board ID.", { code: "pinterest_board_missing" });
  return created.id;
}

export const pinterestPublisher: Publisher = {
  platform: "pinterest",

  validate(input) {
    if (!input.media.length) throw new PublisherError("Pinterest Pins require an image.", { code: "media_required" });
    if (input.media.length !== 1) throw new PublisherError("Pinterest currently supports one image per OmniSocial Pin.", { code: "pinterest_media_count" });
    if (!input.media[0].mimeType.startsWith("image/")) throw new PublisherError("The current OmniSocial Pinterest integration supports image Pins only.", { code: "pinterest_video_not_configured" });
  },

  async publish(input, accessToken) {
    const media = input.media[0];
    const boardId = await resolveBoardId(accessToken, input.account.metadata);
    const response = await providerFetch(`${PINTEREST_API}/pins`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        board_id: boardId,
        title: firstTitle(input.content),
        description: input.content.trim(),
        media_source: { source_type: "image_url", url: media.url, is_standard: true },
      }),
    });
    const data = await response.json() as { id?: string; board_id?: string };
    if (!data.id) throw new PublisherError("Pinterest created the Pin but did not return a Pin ID.", { code: "missing_post_id" });
    return { platformPostId: data.id };
  },

  async refreshToken(_account, refreshToken) {
    const clientId = process.env.PINTEREST_CLIENT_ID?.trim();
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
    const response = await providerFetch(`${PINTEREST_API}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    return data.access_token ? { accessToken: data.access_token, expiresIn: data.expires_in } : null;
  },

  async getAccount(accessToken) {
    const response = await providerFetch(`${PINTEREST_API}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const data = await response.json() as { id?: string; username?: string; profile_image?: string; business_name?: string };
    return {
      external_account_id: data.id,
      account_name: data.business_name || data.username,
      username: data.username,
      avatar_url: data.profile_image,
    };
  },
};
