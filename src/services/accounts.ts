import { Types } from "mongoose";
import { ChartAccount } from "@/models/ChartAccount";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
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
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    return Object.keys(range).length ? { [field]: range } : {};
  };
  const [payments, funds, expenses] = await Promise.all([
    ProjectPayment.find({ organizationId: oid, ...dateMatch("paymentDate") }).populate("projectId").sort({ paymentDate: 1 }).lean(),
    GeneralFund.find({ organizationId: oid, ...dateMatch("fundDate") }).sort({ fundDate: 1 }).lean(),
    Expense.find({ organizationId: oid, approvalStatus: "approved", ...dateMatch("expenseDate") }).populate("projectId categoryId").sort({ expenseDate: 1 }).lean()
  ]);
  const entries: any[] = [];
  for (const payment of payments as any[]) {
    const memo = `Client payment: ${payment.projectId?.name ?? "Project"}`;
    entries.push(line(payment.paymentDate, "ProjectPayment", payment._id, "1000", "Cash / Bank", memo, payment.amount, 0));
    entries.push(line(payment.paymentDate, "ProjectPayment", payment._id, "4000", "Client Project Revenue", memo, 0, payment.amount));
  }
  for (const fund of funds as any[]) {
    const memo = `Owner/other fund: ${fund.note || "Fund added"}`;
    entries.push(line(fund.fundDate, "GeneralFund", fund._id, "1000", "Cash / Bank", memo, fund.amount, 0));
    entries.push(line(fund.fundDate, "GeneralFund", fund._id, "3000", "Owner Equity", memo, 0, fund.amount));
  }
  for (const expense of expenses as any[]) {
    const projectType = expense.projectId?.projectType;
    const accountCode = expense.projectId ? (projectType === "internal" ? "5200" : "5000") : "5100";
    const accountName = expense.projectId ? (projectType === "internal" ? "Internal Project Expenses" : "Project Expenses") : "General Expenses";
    const memo = `Expense: ${expense.description}`;
    entries.push(line(expense.expenseDate, "Expense", expense._id, accountCode, accountName, memo, expense.amount, 0));
    entries.push(line(expense.expenseDate, "Expense", expense._id, "1000", "Cash / Bank", memo, 0, expense.amount));
    if ((expense.tdsAmount ?? 0) > 0) entries.push(line(expense.expenseDate, "Expense", expense._id, "2000", "Tax Payable", `TDS: ${expense.description}`, 0, expense.tdsAmount));
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
