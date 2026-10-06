import { z } from "zod";
import { API_SOCIAL_PLATFORMS, type ApiSocialPlatform } from "./connected-accounts-core.ts";

export const ANALYTICS_METRICS = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "video_views",
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

const analyticsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  platform: z.string().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && new Date(value.from).getTime() >= new Date(value.to).getTime()) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "to must be later than from." });
  }

  if (value.platform) {
    const requested = value.platform
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const invalid = requested.find((item) => !API_SOCIAL_PLATFORMS.includes(item as ApiSocialPlatform));
    if (invalid) {
      ctx.addIssue({ code: "custom", path: ["platform"], message: `Unsupported platform: ${invalid}.` });
    }
  }
});

export type AnalyticsQuery = {
  from: string;
  to: string;
  platforms?: ApiSocialPlatform[];
};

export function parseAnalyticsQuery(searchParams: URLSearchParams):
  | { ok: true; data: AnalyticsQuery }
  | { ok: false; message: string } {
  const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid analytics query.",
    };
  }

  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const platforms = parsed.data.platform
    ? [...new Set(parsed.data.platform.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))] as ApiSocialPlatform[]
    : undefined;

  return {
    ok: true,
    data: {
      from: from.toISOString(),
      to: to.toISOString(),
      platforms,
    },
  };
}

export type AnalyticsTotals = Record<AnalyticsMetric, number>;

export function emptyAnalyticsTotals(): AnalyticsTotals {
  return {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    video_views: 0,
  };
}

export function addAnalyticsTotals(target: AnalyticsTotals, row: Partial<Record<AnalyticsMetric, number | null>>): void {
  for (const metric of ANALYTICS_METRICS) {
    const value = Number(row[metric] ?? 0);
    if (Number.isFinite(value) && value >= 0) target[metric] += value;
  }
}

export function interactionCount(totals: AnalyticsTotals): number {
  return totals.likes + totals.comments + totals.shares + totals.saves;
}

export function engagementRate(totals: AnalyticsTotals): number | null {
  if (totals.impressions <= 0) return null;
  return Number(((interactionCount(totals) / totals.impressions) * 100).toFixed(4));
}

export function toSafeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
