"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

export function SearchBar({ placeholder = "Search", name = "q", defaultValue }: { placeholder?: string; name?: string; defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");
  const [pending, startTransition] = useTransition();
  const currentQuery = searchParams.get(name) ?? "";
  const serializedParams = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  useEffect(() => {
    const nextValue = value.trim();
    if (nextValue === currentQuery) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(serializedParams);
      if (nextValue) params.set(name, nextValue);
      else params.delete(name);
      resetPaginationParams(params);
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [currentQuery, name, pathname, router, serializedParams, value]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="pl-9 pr-9" />
      {pending && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />}
    </div>
  );
}

function resetPaginationParams(params: URLSearchParams) {
  for (const key of Array.from(params.keys())) {
    if (key === "page" || key.endsWith("Page")) params.delete(key);
  }
}
