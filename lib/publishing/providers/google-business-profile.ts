import "server-only";
import { PublisherError, type Publisher, type PublishInput, type PublishResult } from "./types";

function metadata(account: PublishInput["account"]) { return account.metadata as { google_location_name?: string }; }

export const googleBusinessProfilePublisher: Publisher = {
  platform: "google_business_profile",
  validate(input: PublishInput) {
    if (!input.content.trim()) throw new PublisherError("Google Business Profile posts require text.", { code: "content_required" });
    if (input.media.length > 1) throw new PublisherError("Google Business Profile supports one image per post in the current OmniSocial flow.", { code: "too_many_media" });
    if (input.media.some((media) => !["image/jpeg", "image/png"].includes(media.mimeType))) throw new PublisherError("Google Business Profile currently supports JPEG or PNG images.", { code: "unsupported_media" });
  },
  async publish(input: PublishInput, accessToken: string): Promise<PublishResult> {
    const locationName = metadata(input.account).google_location_name;
    if (!locationName) throw new PublisherError("Google Business Profile location is missing from the connected account.", { code: "location_missing" });
    const body: Record<string, unknown> = { languageCode: "en-US", summary: input.content, topicType: "STANDARD" };
    if (input.media[0]) body.media = [{ mediaFormat: "PHOTO", sourceUrl: input.media[0].url }];
    const response = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (!response.ok) throw new PublisherError(`Google Business Profile publishing failed (${response.status}).`, { code: `http_${response.status}`, retryable: response.status >= 500 || response.status === 429 });
    const result = await response.json() as { name?: string };
    if (!result.name) throw new PublisherError("Google Business Profile did not return a post resource.", { code: "provider_response_invalid" });
    return { platformPostId: result.name };
  },
  async getAccount(accessToken: string) {
    const response = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load Google Business Profile accounts.");
    const data = await response.json() as { accounts?: Array<{ name?: string; accountName?: string }> };
    const account = data.accounts?.find((item) => item.name);
    return { external_account_id: account?.name, account_name: account?.accountName || account?.name };
  },
};
