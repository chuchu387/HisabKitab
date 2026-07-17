import { Breadcrumb } from "@/components/breadcrumb";

export function PageShell({ title, description, children, action, breadcrumb }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; breadcrumb?: { label: string; href?: string }[] }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6 sm:space-y-6 sm:pb-8">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-4 rounded-lg border bg-card/90 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">HisabKitab</p>
          <h1 className="mt-1 text-xl font-semibold tracking-normal text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="grid shrink-0 sm:block">{action}</div>}
      </div>
      {children}
    </div>
  );
}
