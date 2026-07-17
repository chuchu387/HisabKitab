import Link from "next/link";
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

void User;

export default async function GeneralFundsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const funds = await GeneralFund.find({ organizationId }).populate("createdBy").sort({ fundDate: -1 }).lean();
  return (
    <PageShell title="Owner/Other Funds" description="Track extra company cash added outside client project payments.">
      <GeneralFundForm />
      <DataTable data={funds} pagination={{ basePath: "/general-funds", searchParams: params }} columns={[
        { header: "Date", cell: (f: any) => formatDate(f.fundDate) },
        { header: "Amount", cell: (f: any) => money(f.amount) },
        { header: "Note", cell: (f: any) => f.note || "-" },
        { header: "Added By", cell: (f: any) => f.createdBy?.name ?? "Unknown" },
        { header: "Receipt", cell: (f: any) => f.receiptImageId ? <Link className="text-primary hover:underline" href={`/api/receipts/${f.receiptImageId}`} target="_blank">View</Link> : "-" },
        { header: "Actions", cell: (f: any) => <form action={deleteGeneralFund}><input type="hidden" name="id" value={f._id.toString()} /><ConfirmButton /></form> }
      ]} />
    </PageShell>
  );
}
