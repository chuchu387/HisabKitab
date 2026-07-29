import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { GeneralFundForm } from "@/features/forms/general-fund-form";
import { deleteGeneralFund } from "@/actions/general-funds";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { GeneralFund } from "@/models/GeneralFund";
import { User } from "@/models/User";
import { BankAccount } from "@/models/BankAccount";
import { FiscalYear } from "@/models/FiscalYear";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

void User;

export default async function GeneralFundsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const fundQuery: any = { organizationId };
  if (fyRange.from || fyRange.to) {
    fundQuery.fundDate = {};
    if (fyRange.from) fundQuery.fundDate.$gte = fyRange.from;
    if (fyRange.to) {
      const end = fyRange.to;
      end.setHours(23, 59, 59, 999);
      fundQuery.fundDate.$lte = end;
    }
  }
  const [funds, bankAccounts] = await Promise.all([
    GeneralFund.find(fundQuery).populate("createdBy bankAccountId").sort({ fundDate: -1 }).lean(),
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean()
  ]);
  return (
    <PageShell title="Owner/Other Funds" description="Track extra company cash added outside client project payments.">
      <GeneralFundForm bankAccounts={JSON.parse(JSON.stringify(bankAccounts))} />
      <form className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="native-control" type="date" name="to" defaultValue={params?.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </form>
      <DataTable data={funds} pagination={{ basePath: "/general-funds", searchParams: params }} columns={[
        { header: "Date", cell: (f: any) => formatDate(f.fundDate) },
        { header: "FY", cell: (f: any) => fiscalYearLabelForDate(f.fundDate) },
        { header: "Amount", cell: (f: any) => money(f.amount) },
        { header: "Note", cell: (f: any) => f.note || "-" },
        { header: "Account", cell: (f: any) => f.bankAccountId?.name ?? "Default" },
        { header: "Added By", cell: (f: any) => f.createdBy?.name ?? "Unknown" },
        { header: "Receipt", cell: (f: any) => f.receiptImageId ? <Link className="text-primary hover:underline" href={`/api/receipts/${f.receiptImageId}`} target="_blank">View</Link> : "-" },
        { header: "Actions", cell: (f: any) => <form action={deleteGeneralFund}><input type="hidden" name="id" value={f._id.toString()} /><ConfirmButton /></form> }
      ]} />
    </PageShell>
  );
}
