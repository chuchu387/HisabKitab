import { Inbox } from "lucide-react";

export function EmptyState({ title = "No records", description = "Create a record or adjust filters.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
