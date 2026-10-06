import { Suspense } from "react";
import ReportsContent from "./reports-content";

export const instant = false;

function ReportsFallback() {
  return <div className="space-y-6"><div className="h-20 animate-pulse rounded-2xl border bg-card" /><div className="h-72 animate-pulse rounded-2xl border bg-card" /><div className="h-64 animate-pulse rounded-2xl border bg-card" /></div>;
}

export default function AnalyticsReportsPage() {
  return <Suspense fallback={<ReportsFallback />}><ReportsContent /></Suspense>;
}
