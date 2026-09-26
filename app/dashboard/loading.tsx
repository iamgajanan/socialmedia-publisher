import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
        <div className="mt-5 h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
        <div className="mt-7 h-11 w-44 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <div className="flex justify-between">
                <div className="size-9 animate-pulse rounded-xl bg-muted" />
                <div className="h-8 w-10 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-4 h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="h-72 animate-pulse bg-muted/40" />
        <Card className="h-72 animate-pulse bg-muted/40" />
      </div>
    </div>
  );
}
