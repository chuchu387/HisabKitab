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
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-primary/15" />
        <div className="space-y-2">
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
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
      <div className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
          <Spinner className="text-primary" />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-secondary/70 p-3 text-sm font-medium text-secondary-foreground">
          <BrandMark className="h-8 w-8 text-xs" />
          <span>{label}</span>
        </div>
        <LoadingState className="mt-4 border-0 bg-transparent p-0 shadow-none" />
      </div>
    </div>
  );
}
