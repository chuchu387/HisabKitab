import { BrandLogo, BrandMark } from "@/components/brand";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden="true"
    />
  );
}

export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-lg border bg-card p-4 shadow-sm", className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricSkeleton delay="0ms" />
        <MetricSkeleton delay="100ms" />
        <MetricSkeleton delay="200ms" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-muted/35 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-28 animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
        </div>
        <div className="grid h-28 grid-cols-12 items-end gap-1">
          {[32, 56, 44, 72, 62, 88, 48, 66, 84, 58, 76, 92].map((height, index) => (
            <div key={index} className="rounded-t bg-primary/25" style={{ height: `${height}%`, animation: `pulse 1.4s ease-in-out ${index * 70}ms infinite` }} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function PageLoader({ label = "Loading HisabKitab..." }: { label?: string }) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border bg-card shadow-xl shadow-primary/5">
        <div className="border-b bg-foreground p-6 text-primary-foreground">
          <div className="flex items-center justify-between gap-4">
            <BrandLogo inverse />
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
              <Spinner className="h-4 w-4 text-accent" />
              Syncing
            </div>
          </div>
          <div className="mt-6">
            <p className="text-2xl font-semibold">Preparing your accounting view</p>
            <p className="mt-1 text-sm text-white/70">{label}</p>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-[loader-slide_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border bg-secondary/60 p-4">
            <BrandMark className="h-12 w-12" />
            <p className="mt-4 text-sm font-semibold">Loading balances, projects, reports, and approvals.</p>
            <p className="mt-2 text-xs text-muted-foreground">HisabKitab keeps tenant data isolated while each workspace is prepared.</p>
          </div>
          <LoadingState className="border-0 bg-transparent p-0 shadow-none" />
        </div>
      </div>
    </div>
  );
}

function MetricSkeleton({ delay }: { delay: string }) {
  return (
    <div className="rounded-lg border bg-card p-3" style={{ animation: `pulse 1.5s ease-in-out ${delay} infinite` }}>
      <div className="h-2.5 w-20 rounded bg-muted" />
      <div className="mt-3 h-5 w-28 rounded bg-primary/15" />
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-2/3 rounded-full bg-primary/30" />
      </div>
    </div>
  );
}
