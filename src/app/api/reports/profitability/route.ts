import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : null;
  const to = searchParams.get("to") ? (() => { const end = new Date(searchParams.get("to") as string); end.setHours(23, 59, 59, 999); return end; })() : null;
  const q = searchParams.get("q") ?? "";

  const projectQuery: any = { organizationId };
  if (q) projectQuery.name = new RegExp(q, "i");
  const dateMatch = (field: string) => ({ ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) });

  const [projects, invoices, expenses, payments] = await Promise.all([
    Project.find(projectQuery).sort({ name: 1 }).lean(),
    Invoice.aggregate([
      { $match: { organizationId, projectId: { $ne: null }, status: { $ne: "void" }, ...(from || to ? { invoiceDate: dateMatch("invoiceDate") } : {}) } },
      { $group: { _id: "$projectId", invoiced: { $sum: "$total" }, count: { $sum: 1 } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId, projectId: { $ne: null }, ...(from || to ? { expenseDate: dateMatch("expenseDate") } : {}) } },
      { $group: { _id: "$projectId", spent: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    ProjectPayment.aggregate([
      { $match: { organizationId, ...(from || to ? { paymentDate: dateMatch("paymentDate") } : {}) } },
      { $group: { _id: "$projectId", collected: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);

  const byId = (rows: any[]) => new Map(rows.map((row) => [row._id.toString(), row]));
  const invoiceMap = byId(invoices);
  const expenseMap = byId(expenses);
  const paymentMap = byId(payments);

  const rows = projects.map((project: any) => {
    const id = project._id.toString();
    const invoiced = invoiceMap.get(id)?.invoiced ?? 0;
    const collected = paymentMap.get(id)?.collected ?? 0;
    const spent = expenseMap.get(id)?.spent ?? 0;
    const profit = invoiced - spent;
    return {
      "Project Code": project.code,
      "Project Name": project.name,
      "Type": project.projectType,
      "Status": project.status,
      "Invoiced Revenue": money(invoiced),
      "Collected": money(collected),
      "Expenses": money(spent),
      "Gross Profit": money(profit),
      "Margin %": (invoiced > 0 ? (profit / invoiced) * 100 : 0).toFixed(1),
      "Invoice Count": invoiceMap.get(id)?.count ?? 0,
      "Expense Count": expenseMap.get(id)?.count ?? 0,
      "Payment Count": paymentMap.get(id)?.count ?? 0
    };
  });

  const csv = Papa.unparse(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="project-profitability.csv"`
    }
  });
}
