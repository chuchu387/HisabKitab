import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";

export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-card",
        variant === "success" && "border-primary/30 bg-primary/10 text-primary",
        variant === "warning" && "border-accent/30 bg-accent/10 text-accent-foreground",
        variant === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-700",
        variant === "muted" && "bg-muted text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
