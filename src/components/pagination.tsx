import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({ page, total, basePath }: { page: number; total: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={`${basePath}?page=${Math.max(1, page - 1)}`}>Previous</Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= pages}>
          <Link href={`${basePath}?page=${Math.min(pages, page + 1)}`}>Next</Link>
        </Button>
      </div>
    </div>
  );
}
