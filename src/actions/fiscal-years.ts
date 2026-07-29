"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { FiscalYear } from "@/models/FiscalYear";
import { fiscalYearSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { getFinancialStatements } from "@/services/financial-statements";
import { getDerivedLedger } from "@/services/accounts";
import { nepalFiscalYearForDate, previousNepalFiscalYear } from "@/services/nepal-fiscal-year";
import type { ActionState } from "@/types";

export async function createFiscalYear(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId } = await requireTenant();
    await requireRole(["owner"]);
    await connectToDatabase();
    const data = parseForm(fiscalYearSchema, formData);
    await FiscalYear.create({ ...data, organizationId });
    revalidatePath("/fiscal-years");
    return { ok: true, message: "Fiscal year created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleFiscalYearStatus(formData: FormData) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "closed" ? "closed" : "open";
  const year = await FiscalYear.findOne({ _id: id, organizationId }).lean() as any;
  if (!year) throw new Error("Fiscal year not found");
  const from = year.startDate.toISOString().slice(0, 10);
  const to = year.endDate.toISOString().slice(0, 10);
  const closingSnapshot = status === "closed" ? await buildClosingSnapshot(organizationId, from, to) : null;
  await FiscalYear.findOneAndUpdate({ _id: id, organizationId }, { status, closedBy: status === "closed" ? session.user.userId : null, closedAt: status === "closed" ? new Date() : null, closingSnapshot });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: status === "closed" ? "Fiscal Year Closed" : "Fiscal Year Reopened", entityType: "FiscalYear", entityId: id, metadata: { name: year.name, from, to, snapshotSaved: Boolean(closingSnapshot) } });
  revalidatePath("/fiscal-years");
  revalidatePath(`/fiscal-years/${id}/closing`);
}

export async function setupCurrentNepalFiscalYear() {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const current = nepalFiscalYearForDate();
  const previous = previousNepalFiscalYear();
  await FiscalYear.updateMany(
    { organizationId, endDate: { $lt: current.startDate }, status: { $ne: "closed" } },
    { status: "closed", closedBy: session.user.userId, closedAt: new Date() }
  );
  await FiscalYear.updateOne(
    { organizationId, name: previous.label },
    {
      $set: { startDate: previous.startDate, endDate: previous.endDate, status: "closed", closedBy: session.user.userId, closedAt: new Date() },
      $setOnInsert: { organizationId }
    },
    { upsert: true }
  );
  await FiscalYear.updateOne(
    { organizationId, name: current.label },
    {
      $set: { startDate: current.startDate, endDate: current.endDate, status: "open", closedBy: null, closedAt: null },
      $setOnInsert: { organizationId }
    },
    { upsert: true }
  );
  revalidatePath("/fiscal-years");
  revalidatePath("/accounts");
}

async function buildClosingSnapshot(organizationId: string, from: string, to: string) {
  const [statements, ledger] = await Promise.all([
    getFinancialStatements({ organizationId, from, to }),
    getDerivedLedger(organizationId, from, to)
  ]);
  const debit = ledger.summary.reduce((sum: number, row: any) => sum + (row.debit ?? 0), 0);
  const credit = ledger.summary.reduce((sum: number, row: any) => sum + (row.credit ?? 0), 0);
  return {
    generatedAt: new Date(),
    period: statements.period,
    summary: statements.summary,
    balanceSheet: statements.balanceSheet,
    profitAndLoss: statements.profitAndLoss,
    cashFlow: statements.cashFlow,
    trialBalance: statements.trialBalance,
    receivables: statements.receivables,
    trialSummary: { debit, credit, difference: Number((debit - credit).toFixed(2)) }
  };
}
