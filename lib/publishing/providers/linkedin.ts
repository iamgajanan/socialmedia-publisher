import "server-only";
import { providerFetch } from "./http";
import { PublisherError, type PublishInput, type Publisher } from "./types";

const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION?.trim() || "202603";
export const linkedinPublisher: Publisher = {
  platform: "linkedin",
  validate(input) {
    if (!input.content.trim() && input.media.length === 0) throw new PublisherError("LinkedIn posts need text or supported media.", { code: "empty_post" });
    if (input.media.length > 0) throw new PublisherError("LinkedIn media publishing requires the LinkedIn asset-upload products to be enabled; this account currently supports text publishing only.", { code: "linkedin_media_not_configured" });
    if (input.content.length > 3000) throw new PublisherError("LinkedIn content exceeds the 3,000 character limit.", { code: "content_too_long" });
  },
  async publish(input, accessToken) {
    const author = input.account.metadata.linkedin_author_urn ? String(input.account.metadata.linkedin_author_urn) : `urn:li:person:${input.account.external_account_id}`;
    const response = await providerFetch("https://api.linkedin.com/rest/posts", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0", "Linkedin-Version": LINKEDIN_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({ author, commentary: input.content, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }),
    });
    const id = response.headers.get("x-restli-id");
    if (!id) throw new PublisherError("LinkedIn published the post but did not return a post ID.", { code: "missing_post_id" });
    return { platformPostId: id };
  },
  async getAccount(accessToken) {
    const response = await providerFetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json() as Record<string, unknown>;
    return { external_account_id: String(data.sub ?? ""), account_name: typeof data.name === "string" ? data.name : undefined };
  },
};
