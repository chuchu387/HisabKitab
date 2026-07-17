import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-normal text-primary-foreground shadow-sm ring-1 ring-primary/20",
        className
      )}
      aria-hidden="true"
    >
      HK
    </span>
  );
}

export function BrandLogo({ href = "/dashboard", compact = false, onClick }: { href?: string; compact?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <BrandMark />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold leading-none text-foreground">HisabKitab</span>
          <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">Accounting workspace</span>
        </span>
      )}
    </Link>
  );
}
