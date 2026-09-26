import "server-only";
import { facebookPublisher, instagramPublisher } from "./meta";
import { linkedinPublisher } from "./linkedin";
import { tiktokPublisher } from "./tiktok";
import { xPublisher } from "./x";
import { youtubePublisher } from "./youtube";
import type { Publisher, PublisherAccount } from "./types";
const publishers: Record<string, Publisher> = { facebook: facebookPublisher, instagram: instagramPublisher, linkedin: linkedinPublisher, x: xPublisher, tiktok: tiktokPublisher, youtube: youtubePublisher };
export function getPublisher(platform: string) { const publisher = publishers[platform]; if (!publisher) throw new Error(`No publisher is configured for ${platform}.`); return publisher; }
export function getAllPublishers() { return Object.values(publishers); }
export type { Publisher, PublisherAccount };
