import { Breadcrumb } from "@/components/breadcrumb";

export function PageShell({ title, description, children, action, breadcrumb }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; breadcrumb?: { label: string; href?: string }[] }) {
  return (
    <div className="space-y-6">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
