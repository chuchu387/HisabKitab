import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-primary-foreground shadow-sm ring-1 ring-border",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="7" width="26" height="34" rx="5" fill="hsl(var(--card))" />
        <path d="M16 15h11M16 22h14M16 29h8" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
        <path d="M31 15c5 2 8 6 8 11s-3 9-8 11" stroke="hsl(var(--accent))" strokeWidth="4" strokeLinecap="round" />
        <path d="M31 20h-7m7 6h-7m6 0c0 5-3 8-8 8" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function BrandLogo({ href = "/dashboard", compact = false, inverse = false, onClick }: { href?: string; compact?: boolean; inverse?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <BrandMark />
      {!compact && (
        <span className="min-w-0">
          <span className={cn("block truncate text-base font-semibold leading-none", inverse ? "text-white" : "text-foreground")}>HisabKitab</span>
          <span className={cn("mt-1 block truncate text-xs font-medium", inverse ? "text-white/65" : "text-muted-foreground")}>Accounting workspace</span>
        </span>
      )}
    </Link>
  );
}
