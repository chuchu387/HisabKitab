import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({ data, columns }: { data: T[]; columns: Column<T>[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
            <tr>{columns.map((column) => <th key={column.header} className={cn("whitespace-nowrap px-4 py-3 font-medium", column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.map((row, index) => (
              <tr key={index} className="transition-colors hover:bg-muted/50">
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
    </div>
  );
}
