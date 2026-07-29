import { Types } from "mongoose";
import { ChartAccount } from "@/models/ChartAccount";
import { BankAccount } from "@/models/BankAccount";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";
import { OpeningBalance } from "@/models/OpeningBalance";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

export const defaultChartAccounts = [
  { code: "1000", name: "Cash / Bank", type: "asset", normalBalance: "debit" },
  { code: "1100", name: "Accounts Receivable", type: "asset", normalBalance: "debit" },
  { code: "2000", name: "Tax Payable", type: "liability", normalBalance: "credit" },
  { code: "3000", name: "Owner Equity", type: "equity", normalBalance: "credit" },
  { code: "4000", name: "Client Project Revenue", type: "revenue", normalBalance: "credit" },
  { code: "5000", name: "Project Expenses", type: "expense", normalBalance: "debit" },
  { code: "5100", name: "General Expenses", type: "expense", normalBalance: "debit" },
  { code: "5200", name: "Internal Project Expenses", type: "expense", normalBalance: "debit" }
] as const;

export async function ensureDefaultChartAccounts(organizationId: string) {
  await ChartAccount.bulkWrite(defaultChartAccounts.map((account) => ({
    updateOne: {
      filter: { organizationId, code: account.code },
      update: { $setOnInsert: { ...account, organizationId, active: true } },
      upsert: true
    }
  })));
}

export async function getDerivedLedger(organizationId: string, from?: string, to?: string, accountCode?: string) {
  const oid = new Types.ObjectId(organizationId);
  const dateMatch = (field: string) => {
    const range: Record<string, Date> = {};
    const start = parseDate(from);
    if (start) range.$gte = start;
    if (to) {
      const end = parseDate(to);
      if (!end) return Object.keys(range).length ? { [field]: range } : {};
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    return Object.keys(range).length ? { [field]: range } : {};
  };
  const [payments, funds, expenses, openingBalances, bankAccounts, journals] = await Promise.all([
    ProjectPayment.find({ organizationId: oid, ...dateMatch("paymentDate") }).populate("projectId bankAccountId").sort({ paymentDate: 1 }).lean(),
    GeneralFund.find({ organizationId: oid, ...dateMatch("fundDate") }).populate("bankAccountId").sort({ fundDate: 1 }).lean(),
    Expense.find({ organizationId: oid, approvalStatus: "approved", ...dateMatch("expenseDate") }).populate("projectId categoryId bankAccountId").sort({ expenseDate: 1 }).lean(),
    OpeningBalance.find({ organizationId: oid }).sort({ createdAt: 1 }).lean(),
    BankAccount.find({ organizationId: oid, active: true }).sort({ name: 1 }).lean(),
    ManualJournalEntry.find({ organizationId: oid, ...dateMatch("entryDate") }).sort({ entryDate: 1 }).lean()
  ]);
  const entries: any[] = [];
  for (const account of bankAccounts as any[]) {
    if ((account.openingBalance ?? 0) === 0) continue;
    const debit = account.openingBalance > 0 ? account.openingBalance : 0;
    const credit = account.openingBalance < 0 ? Math.abs(account.openingBalance) : 0;
    entries.push(line(account.createdAt, "BankAccount", account._id, "1000", `Cash / Bank - ${account.name}`, "Bank account opening balance", debit, credit));
  }
  for (const opening of openingBalances as any[]) {
    entries.push(line(opening.createdAt, "OpeningBalance", opening._id, opening.accountCode, opening.accountName, opening.note || "Opening balance", opening.debit ?? 0, opening.credit ?? 0));
  }
  for (const payment of payments as any[]) {
    const memo = `Client payment: ${payment.projectId?.name ?? "Project"}`;
    entries.push(line(payment.paymentDate, "ProjectPayment", payment._id, "1000", cashAccountName(payment.bankAccountId), memo, payment.amount, 0));
    entries.push(line(payment.paymentDate, "ProjectPayment", payment._id, "4000", "Client Project Revenue", memo, 0, payment.amount));
  }
  for (const fund of funds as any[]) {
    const memo = `Owner/other fund: ${fund.note || "Fund added"}`;
    entries.push(line(fund.fundDate, "GeneralFund", fund._id, "1000", cashAccountName(fund.bankAccountId), memo, fund.amount, 0));
    entries.push(line(fund.fundDate, "GeneralFund", fund._id, "3000", "Owner Equity", memo, 0, fund.amount));
  }
  for (const expense of expenses as any[]) {
    const projectType = expense.projectId?.projectType;
    const accountCode = expense.projectId ? (projectType === "internal" ? "5200" : "5000") : "5100";
    const accountName = expense.projectId ? (projectType === "internal" ? "Internal Project Expenses" : "Project Expenses") : "General Expenses";
    const memo = `Expense: ${expense.description}`;
    entries.push(line(expense.expenseDate, "Expense", expense._id, accountCode, accountName, memo, expense.amount, 0));
    entries.push(line(expense.expenseDate, "Expense", expense._id, "1000", cashAccountName(expense.bankAccountId), memo, 0, expense.amount));
    if ((expense.tdsAmount ?? 0) > 0) entries.push(line(expense.expenseDate, "Expense", expense._id, "2000", "Tax Payable", `TDS: ${expense.description}`, 0, expense.tdsAmount));
  }
  for (const journal of journals as any[]) {
    for (const item of journal.lines ?? []) {
      entries.push(line(journal.entryDate, "ManualJournal", journal._id, item.accountCode, item.accountName, journal.memo, item.debit ?? 0, item.credit ?? 0));
    }
  }
  const filteredEntries = accountCode ? entries.filter((entry) => entry.accountCode === accountCode) : entries;
  const summary = Array.from(filteredEntries.reduce((acc, entry) => {
    const current = acc.get(entry.accountCode) ?? { accountCode: entry.accountCode, accountName: entry.accountName, debit: 0, credit: 0, balance: 0 };
    current.debit += entry.debit;
    current.credit += entry.credit;
    current.balance = current.debit - current.credit;
    acc.set(entry.accountCode, current);
    return acc;
  }, new Map()).values());
  return { entries: filteredEntries, summary };
}

function line(date: Date, sourceType: string, sourceId: unknown, accountCode: string, accountName: string, memo: string, debit: number, credit: number) {
  return { date, sourceType, sourceId: sourceId?.toString?.() ?? String(sourceId), accountCode, accountName, memo, debit, credit };
}

function cashAccountName(bankAccount: any) {
  return bankAccount?.name ? `Cash / Bank - ${bankAccount.name}` : "Cash / Bank";
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
