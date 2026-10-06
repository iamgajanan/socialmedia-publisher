"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncResponse = { ok?: boolean; error?: string; results?: Array<{ metricsWritten?: number }> };

export function AnalyticsSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/analytics/sync", { method: "POST" });
      const body = (await response.json()) as SyncResponse;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Sync failed.");
      const written = (body.results ?? []).reduce((total, item) => total + (item.metricsWritten ?? 0), 0);
      setMessage(`Synced successfully · ${written} metric snapshots updated`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
      <Button onClick={sync} disabled={loading} variant="outline">
        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
        {loading ? "Syncing…" : "Sync analytics"}
      </Button>
    </div>
  );
}
