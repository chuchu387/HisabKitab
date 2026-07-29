import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { FiscalYearForm } from "@/features/forms/fiscal-year-form";
import { setupCurrentNepalFiscalYear, toggleFiscalYearStatus } from "@/actions/fiscal-years";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { NepalFiscalYearSetupButton } from "@/features/forms/fiscal-year-form";

export default async function FiscalYearsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const years = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).lean();
  return (
    <PageShell title="Fiscal Years" description="Close audited fiscal years to prevent accidental edits to old accounting records.">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <FiscalYearForm />
        <form action={setupCurrentNepalFiscalYear} className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Nepal Fiscal Year</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create/open the running Nepal FY and close previous FYs.</p>
          <NepalFiscalYearSetupButton />
        </form>
      </div>
      <DataTable data={years} pagination={{ basePath: "/fiscal-years", searchParams: params }} columns={[
        { header: "Name", cell: (year: any) => year.name },
        { header: "Start", cell: (year: any) => formatDate(year.startDate) },
        { header: "End", cell: (year: any) => formatDate(year.endDate) },
        { header: "Status", cell: (year: any) => <Badge variant={year.status === "closed" ? "danger" : "success"}>{year.status}</Badge> },
        { header: "Actions", cell: (year: any) => <form action={toggleFiscalYearStatus}><input type="hidden" name="id" value={year._id.toString()} /><input type="hidden" name="status" value={year.status === "closed" ? "open" : "closed"} /><ConfirmButton label={year.status === "closed" ? "Reopen" : "Close"} title={`${year.status === "closed" ? "Reopen" : "Close"} fiscal year?`} description="This changes whether transactions in this date range can be edited." /></form> }
      ]} />
    </PageShell>
  );
}
