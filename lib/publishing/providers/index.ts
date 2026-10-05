import "server-only";
import { facebookPublisher, instagramPublisher } from "./meta";
import { linkedinPublisher } from "./linkedin";
import { pinterestPublisher } from "./pinterest";
import { threadsPublisher } from "./threads";
import { tiktokPublisher } from "./tiktok";
import { xPublisher } from "./x";
import { youtubePublisher } from "./youtube";
import { blueskyPublisher } from "./bluesky";
import { googleBusinessProfilePublisher } from "./google-business-profile";
import { redditPublisher } from "./reddit";
import type { Publisher, PublisherAccount } from "./types";
const publishers: Record<string, Publisher> = { facebook: facebookPublisher, instagram: instagramPublisher, threads: threadsPublisher, linkedin: linkedinPublisher, x: xPublisher, tiktok: tiktokPublisher, youtube: youtubePublisher, pinterest: pinterestPublisher, bluesky: blueskyPublisher, google_business_profile: googleBusinessProfilePublisher, reddit: redditPublisher };
export function getPublisher(platform: string) { const publisher = publishers[platform]; if (!publisher) throw new Error(`No publisher is configured for ${platform}.`); return publisher; }
export function getAllPublishers() { return Object.values(publishers); }
export type { Publisher, PublisherAccount };
