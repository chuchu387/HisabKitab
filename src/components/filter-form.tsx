"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useTransition } from "react";
import { cn } from "@/lib/utils";

export function FilterForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") continue;
      if (!value) continue;
      params.set(key, value);
    }
    resetPaginationParams(params);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <form className={cn(className, pending && "opacity-80")} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

function resetPaginationParams(params: URLSearchParams) {
  for (const key of Array.from(params.keys())) {
    if (key === "page" || key.endsWith("Page") || key.endsWith("PageSize")) params.delete(key);
  }
}
