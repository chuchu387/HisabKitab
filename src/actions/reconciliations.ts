"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { BankAccount } from "@/models/BankAccount";
import { BankReconciliation } from "@/models/BankReconciliation";
import { actionError, parseForm } from "@/actions/helpers";
import { getBankSystemBalances, matchBankStatementRows } from "@/services/reconciliation";
import { nextVoucherNumber } from "@/services/vouchers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

const reconciliationSchema = z.object({
  bankAccountId: z.string().min(1, "Account is required"),
  statementDate: z.coerce.date(),
  statementBalance: z.coerce.number(),
  note: z.string().optional().default("")
});

export async function createBankReconciliation(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(reconciliationSchema, formData);
    const account = await BankAccount.findOne({ _id: data.bankAccountId, organizationId }).select("name").lean();
    if (!account) throw new Error("Bank account not found");
    const balances = await getBankSystemBalances(organizationId, data.statementDate);
    const systemBalance = balances.find((item) => item.bankAccountId === data.bankAccountId)?.balance ?? 0;
    const difference = round(systemBalance - data.statementBalance);
    const importedRows = await parseStatementCsv(formData.get("statementCsv"));
    const matchedRows = importedRows.length ? await matchBankStatementRows(organizationId, data.bankAccountId, importedRows) : [];
    const matchedRowCount = matchedRows.filter((row) => row.matched).length;
    const voucherNumber = await nextVoucherNumber(BankReconciliation, organizationId, "reconciliation", data.statementDate);
    const reconciliation = await BankReconciliation.create({
      organizationId,
      voucherNumber,
      bankAccountId: data.bankAccountId,
      statementDate: data.statementDate,
      systemBalance,
      statementBalance: data.statementBalance,
      difference,
      importedRowCount: matchedRows.length,
      matchedRowCount,
      unmatchedRowCount: matchedRows.length - matchedRowCount,
      importedRows: matchedRows,
      note: data.note,
      createdBy: session.user.userId
    });
    await writeAuditLog({
      organizationId,
      userId: session.user.userId,
      action: "Bank Reconciliation Created",
      entityType: "BankReconciliation",
      entityId: reconciliation._id.toString(),
      metadata: { voucherNumber, bankAccountId: data.bankAccountId, systemBalance, statementBalance: data.statementBalance, difference, importedRowCount: matchedRows.length, matchedRowCount }
    });
    revalidatePath("/reconciliation");
    return { ok: true, message: difference === 0 ? "Reconciliation saved and matched" : "Reconciliation saved with difference" };
  } catch (error) {
    return actionError(error);
  }
}

function round(value: number) {
  return Number(value.toFixed(2));
}

async function parseStatementCsv(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return [];
  const text = await file.text();
  const Papa = await import("papaparse");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  return parsed.data.map((row) => {
    const debit = Math.abs(parseAmount(cell(row, "debit", "Debit", "withdrawal", "Withdrawal", "paid", "Paid")));
    const credit = Math.abs(parseAmount(cell(row, "credit", "Credit", "deposit", "Deposit", "received", "Received")));
    const signedAmount = parseAmount(cell(row, "amount", "Amount", "transaction amount", "Transaction Amount"));
    const amount = credit || debit || Math.abs(signedAmount);
    const direction: "inflow" | "outflow" | "unknown" = credit > 0 || signedAmount > 0 ? "inflow" : debit > 0 || signedAmount < 0 ? "outflow" : "unknown";
    return {
      date: parseDate(cell(row, "date", "Date", "transaction date", "Transaction Date", "value date", "Value Date")),
      description: cell(row, "description", "Description", "particulars", "Particulars", "narration", "Narration"),
      reference: cell(row, "reference", "Reference", "ref", "Ref", "voucher", "Voucher", "cheque", "Cheque"),
      debit,
      credit,
      amount,
      direction,
      balance: parseNullableAmount(cell(row, "balance", "Balance", "closing balance", "Closing Balance"))
    };
  }).filter((row) => row.amount > 0);
}

function cell(row: Record<string, string>, ...keys: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? "").trim()]));
  for (const key of keys) {
    const value = normalized.get(key.trim().toLowerCase());
    if (value) return value;
  }
  return "";
}

function parseAmount(value: string) {
  const negative = /^\s*\(.*\)\s*$/.test(value) || /\bdr\b/i.test(value);
  const normalized = value
    .replace(/\b(?:rs|npr)\.?\b/gi, "")
    .replace(/,/g, "")
    .trim();
  const cleaned = normalized.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function parseNullableAmount(value: string) {
  if (!value) return null;
  return parseAmount(value);
}

function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const [, rawDay, rawMonth, rawYear] = match;
  const year = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear);
  const date = new Date(year, Number(rawMonth) - 1, Number(rawDay));
  return Number.isNaN(date.getTime()) ? null : date;
}
