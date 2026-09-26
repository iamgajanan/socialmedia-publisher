"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      <Card className="w-full max-w-lg shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Dashboard could not load</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Something went wrong while loading your workspace. Try again and
            your data should reload.
          </p>
          <Button onClick={() => reset()} className="mt-6">
            <RotateCcw />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
