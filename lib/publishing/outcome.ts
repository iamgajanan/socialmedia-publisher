export type PublishingDestinationOutcome = {
  status: string;
  nextRetryAt?: string | null;
};

export type PublishingPostOutcome = "published" | "retrying" | "failed" | "scheduled";

export function getPublishingPostOutcome(rows: PublishingDestinationOutcome[]): PublishingPostOutcome {
  const statuses = rows.map((row) => row.status);
  if (statuses.length && statuses.every((status) => status === "published")) return "published";
  if (rows.some((row) => row.status === "failed" && row.nextRetryAt)) return "retrying";
  if (statuses.some((status) => status === "failed")) return "failed";
  return "scheduled";
}
