import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { BankAccountForm } from "@/features/forms/bank-account-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { BankAccount } from "@/models/BankAccount";

export default async function BankAccountsPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const accounts = await BankAccount.find({ organizationId }).sort({ name: 1 }).lean();
  return (
    <PageShell title="Bank Accounts" description="Manage cash, bank, and wallet accounts used for payments, funds, and ledger reporting.">
      <BankAccountForm />
      <DataTable data={accounts} pagination={{ basePath: "/bank-accounts", searchParams: params }} columns={[
        { header: "Name", cell: (account: any) => account.name },
        { header: "Code", cell: (account: any) => account.code },
        { header: "Type", cell: (account: any) => <Badge variant="info">{account.type}</Badge> },
        { header: "Account No.", cell: (account: any) => account.accountNumber || "-" },
        { header: "Opening Balance", cell: (account: any) => money(account.openingBalance ?? 0) },
        { header: "Status", cell: (account: any) => account.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge> }
      ]} />
    </PageShell>
  );
}
