import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type PaginationConfig = {
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
  page?: number;
  pageSize?: number;
  total?: number;
  pageParam?: string;
  pageSizeParam?: string;
};

const pageSizeOptions = [10, 25, 50, 100];

export function DataTable<T>({ data, columns, pagination }: { data: T[]; columns: Column<T>[]; pagination?: PaginationConfig }) {
  if (!data.length) return <EmptyState />;
  const pageParam = pagination?.pageParam ?? "page";
  const pageSizeParam = pagination?.pageSizeParam ?? "pageSize";
  const requestedPageSize = pagination?.pageSize ?? parsePositiveInt(pagination?.searchParams?.[pageSizeParam], 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const totalRows = pagination?.total ?? data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = pagination?.page ?? parsePositiveInt(pagination?.searchParams?.[pageParam], 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * pageSize;
  const rows = pagination?.total === undefined && pagination ? data.slice(start, start + pageSize) : data;
  return (
    <div className="max-w-full overflow-hidden rounded-lg border bg-card shadow-sm shadow-foreground/5">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="sticky top-0 z-10 bg-foreground text-left text-primary-foreground">
            <tr>{columns.map((column) => <th key={column.header} className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide", column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, index) => (
              <tr key={index} className="transition-colors even:bg-muted/20 hover:bg-secondary/45">
                {columns.map((column) => (
                  <td key={column.header} className={cn("px-4 py-3 align-middle", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <AdvancedPagination
          basePath={pagination.basePath}
          searchParams={pagination.searchParams}
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          totalPages={totalPages}
          pageParam={pageParam}
          pageSizeParam={pageSizeParam}
          start={start}
          visibleRows={rows.length}
        />
      )}
    </div>
  );
}

function AdvancedPagination({
  basePath,
  searchParams,
  page,
  pageSize,
  totalRows,
  totalPages,
  pageParam,
  pageSizeParam,
  start,
  visibleRows
}: {
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  pageParam: string;
  pageSizeParam: string;
  start: number;
  visibleRows: number;
}) {
  const pages = pageWindow(page, totalPages);
  return (
    <div className="flex flex-col gap-3 border-t bg-muted/25 px-3 py-3 text-sm text-muted-foreground sm:px-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Showing <span className="font-medium text-foreground">{start + 1}-{start + visibleRows}</span> of <span className="font-medium text-foreground">{totalRows}</span>
        </span>
        <span className="hidden text-border sm:inline">|</span>
        <span>Page {page} of {totalPages}</span>
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-sm sm:w-auto">
          {pageSizeOptions.map((option) => (
            <Link
              key={option}
              href={pageHref(basePath, searchParams, pageParam, 1, pageSizeParam, option)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground",
                option === pageSize && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {option}
            </Link>
          ))}
        </div>
        <div className="flex w-full items-center gap-1 overflow-x-auto sm:w-auto">
          <PageLink className="hidden sm:inline-flex" label="First" href={pageHref(basePath, searchParams, pageParam, 1, pageSizeParam, pageSize)} disabled={page <= 1} />
          <PageLink label="Prev" href={pageHref(basePath, searchParams, pageParam, page - 1, pageSizeParam, pageSize)} disabled={page <= 1} />
          {pages.map((item, index) => item === "gap" ? (
            <span key={`${item}-${index}`} className="px-2">...</span>
          ) : (
            <PageLink key={item} label={String(item)} href={pageHref(basePath, searchParams, pageParam, item, pageSizeParam, pageSize)} active={item === page} />
          ))}
          <PageLink label="Next" href={pageHref(basePath, searchParams, pageParam, page + 1, pageSizeParam, pageSize)} disabled={page >= totalPages} />
          <PageLink className="hidden sm:inline-flex" label="Last" href={pageHref(basePath, searchParams, pageParam, totalPages, pageSizeParam, pageSize)} disabled={page >= totalPages} />
        </div>
      </div>
    </div>
  );
}

function PageLink({ label, href, active, disabled, className }: { label: string; href: string; active?: boolean; disabled?: boolean; className?: string }) {
  if (disabled) {
    return <span className={cn("rounded-lg border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground opacity-60", className)}>{label}</span>;
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary hover:text-secondary-foreground",
        active && "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        className
      )}
    >
      {label}
    </Link>
  );
}

function pageHref(basePath: string, searchParams: Record<string, string | string[] | undefined> | undefined, pageParam: string, page: number, pageSizeParam: string, pageSize: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  params.set(pageParam, String(page));
  params.set(pageSizeParam, String(pageSize));
  return `${basePath}?${params.toString()}`;
}

function pageWindow(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: Array<number | "gap"> = [1];
  if (page > 4) pages.push("gap");
  for (let item = Math.max(2, page - 1); item <= Math.min(totalPages - 1, page + 1); item += 1) pages.push(item);
  if (page < totalPages - 3) pages.push("gap");
  pages.push(totalPages);
  return pages;
}

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
