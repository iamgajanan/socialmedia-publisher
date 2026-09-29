export type PublishingDestinationOutcome = {
  status: string;
  nextRetryAt?: string | null;
};

export type PublishingPostOutcome = "published" | "retrying" | "failed" | "scheduled";

export function getPublishingPostOutcome(rows: PublishingDestinationOutcome[]): PublishingPostOutcome {
  const statuses = rows.map((row) => row.status);
  const terminalStatuses = statuses.filter((status) => status !== "skipped");
  if (terminalStatuses.length && terminalStatuses.every((status) => status === "published")) return "published";
  if (rows.some((row) => row.status === "failed" && row.nextRetryAt)) return "retrying";
  if (terminalStatuses.some((status) => status === "failed")) return "failed";
  return "scheduled";
}
