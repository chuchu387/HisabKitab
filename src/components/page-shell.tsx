import { Breadcrumb } from "@/components/breadcrumb";

export function PageShell({ title, description, children, action, breadcrumb }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; breadcrumb?: { label: string; href?: string }[] }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-4 rounded-lg border bg-card/90 p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">HisabKitab</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
