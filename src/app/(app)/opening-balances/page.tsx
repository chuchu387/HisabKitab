import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { OpeningBalanceForm } from "@/features/forms/opening-balance-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { OpeningBalance } from "@/models/OpeningBalance";

export default async function OpeningBalancesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const params = await searchParams;
  const [balances, fiscalYears] = await Promise.all([
    OpeningBalance.find({ organizationId }).populate("fiscalYearId").sort({ createdAt: -1 }).lean(),
    FiscalYear.find({ organizationId }).sort({ startDate: -1 }).lean()
  ]);
  return (
    <PageShell title="Opening Balances" description="Set starting balances for the first audited fiscal year. Owner only.">
      <OpeningBalanceForm fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
      <DataTable data={balances} pagination={{ basePath: "/opening-balances", searchParams: params }} columns={[
        { header: "FY", cell: (balance: any) => balance.fiscalYearId?.name ?? "-" },
        { header: "Code", cell: (balance: any) => balance.accountCode },
        { header: "Account", cell: (balance: any) => balance.accountName },
        { header: "Debit", cell: (balance: any) => money(balance.debit ?? 0) },
        { header: "Credit", cell: (balance: any) => money(balance.credit ?? 0) },
        { header: "Note", cell: (balance: any) => balance.note || "-" }
      ]} />
    </PageShell>
  );
}
