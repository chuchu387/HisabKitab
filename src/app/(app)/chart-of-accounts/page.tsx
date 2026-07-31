import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { ChartAccount } from "@/models/ChartAccount";
import { ensureDefaultChartAccounts } from "@/services/accounts";

export default async function ChartOfAccountsPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  await ensureDefaultChartAccounts(organizationId);
  const params = await searchParams;
  const accounts = await ChartAccount.find({ organizationId }).sort({ code: 1 }).lean();
  return (
    <PageShell title="Chart of Accounts" description="Standard accounts used for the generated debit/credit ledger.">
      <DataTable data={accounts} pagination={{ basePath: "/chart-of-accounts", searchParams: params }} columns={[
        { header: "Code", cell: (account: any) => account.code },
        { header: "Account", cell: (account: any) => account.name },
        { header: "Type", cell: (account: any) => <Badge variant="info">{account.type}</Badge> },
        { header: "Normal Balance", cell: (account: any) => account.normalBalance },
        { header: "Status", cell: (account: any) => account.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge> }
      ]} />
    </PageShell>
  );
}
