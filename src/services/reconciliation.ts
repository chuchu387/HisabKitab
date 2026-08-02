import { Types } from "mongoose";
import { BankAccount } from "@/models/BankAccount";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
import { ProjectPayment } from "@/models/ProjectPayment";

type StatementRow = {
  date: Date | null;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  amount: number;
  direction: "inflow" | "outflow" | "unknown";
  balance: number | null;
};

export type BankSystemBalance = {
  bankAccountId: string;
  name: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  balance: number;
};

export async function getBankSystemBalances(organizationId: string, throughDate = new Date()) {
  const oid = new Types.ObjectId(organizationId);
  const through = new Date(throughDate);
  through.setHours(23, 59, 59, 999);
  const [accounts, payments, funds, expenses] = await Promise.all([
    BankAccount.find({ organizationId: oid, active: true }).sort({ name: 1 }).lean(),
    ProjectPayment.aggregate([
      { $match: { organizationId: oid, bankAccountId: { $ne: null }, paymentDate: { $lte: through } } },
      { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } }
    ]),
    GeneralFund.aggregate([
      { $match: { organizationId: oid, bankAccountId: { $ne: null }, fundDate: { $lte: through } } },
      { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, bankAccountId: { $ne: null }, approvalStatus: "approved", expenseDate: { $lte: through } } },
      { $group: { _id: "$bankAccountId", total: { $sum: "$amount" } } }
    ])
  ]);
  const paymentMap = totalMap(payments);
  const fundMap = totalMap(funds);
  const expenseMap = totalMap(expenses);
  return (accounts as any[]).map((account) => {
    const bankAccountId = account._id.toString();
    const openingBalance = account.openingBalance ?? 0;
    const inflow = (paymentMap.get(bankAccountId) ?? 0) + (fundMap.get(bankAccountId) ?? 0);
    const outflow = expenseMap.get(bankAccountId) ?? 0;
    return {
      bankAccountId,
      name: account.name,
      openingBalance,
      inflow,
      outflow,
      balance: round(openingBalance + inflow - outflow)
    };
  });
}

export async function matchBankStatementRows(organizationId: string, bankAccountId: string, rows: StatementRow[]) {
  const oid = new Types.ObjectId(organizationId);
  const accountId = new Types.ObjectId(bankAccountId);
  const dates = rows.map((row) => row.date).filter(Boolean) as Date[];
  const from = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date(0);
  const to = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : new Date();
  from.setDate(from.getDate() - 3);
  to.setDate(to.getDate() + 3);

  const [payments, funds, expenses] = await Promise.all([
    ProjectPayment.find({ organizationId: oid, bankAccountId: accountId, paymentDate: { $gte: from, $lte: to } }).select("_id voucherNumber paymentDate amount note").lean(),
    GeneralFund.find({ organizationId: oid, bankAccountId: accountId, fundDate: { $gte: from, $lte: to } }).select("_id voucherNumber fundDate amount note").lean(),
    Expense.find({ organizationId: oid, bankAccountId: accountId, approvalStatus: "approved", expenseDate: { $gte: from, $lte: to } }).select("_id voucherNumber expenseDate amount description").lean()
  ]);

  const candidates = [
    ...(payments as any[]).map((item) => candidate("ProjectPayment", item, item.paymentDate, "inflow", item.note)),
    ...(funds as any[]).map((item) => candidate("GeneralFund", item, item.fundDate, "inflow", item.note)),
    ...(expenses as any[]).map((item) => candidate("Expense", item, item.expenseDate, "outflow", item.description))
  ];
  const used = new Set<string>();

  return rows.map((row) => {
    const match = candidates.find((item) => !used.has(item.id) && item.direction === row.direction && amountsEqual(item.amount, row.amount) && sameDate(item.date, row.date) && refMatches(row, item));
    const fallback = match ?? candidates.find((item) => !used.has(item.id) && item.direction === row.direction && amountsEqual(item.amount, row.amount) && withinDays(item.date, row.date, 2));
    if (!fallback) return { ...row, matched: false, matchedEntityType: "", matchedEntityId: null, matchedVoucherNumber: "", matchConfidence: "none" };
    used.add(fallback.id);
    return {
      ...row,
      matched: true,
      matchedEntityType: fallback.entityType,
      matchedEntityId: fallback._id,
      matchedVoucherNumber: fallback.voucherNumber,
      matchConfidence: match ? "exact" : "probable"
    };
  });
}

function totalMap(rows: any[]) {
  return new Map(rows.map((row) => [row._id?.toString?.(), row.total ?? 0]));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function candidate(entityType: string, item: any, date: Date, direction: "inflow" | "outflow", note = "") {
  return {
    id: item._id.toString(),
    _id: item._id,
    entityType,
    voucherNumber: item.voucherNumber ?? "",
    date: new Date(date),
    amount: Number(item.amount ?? 0),
    direction,
    note: String(note ?? "")
  };
}

function amountsEqual(left: number, right: number) {
  return Math.abs(round(Number(left) - Number(right))) <= 0.01;
}

function sameDate(left: Date | null, right: Date | null) {
  if (!left || !right) return false;
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function withinDays(left: Date | null, right: Date | null, days: number) {
  if (!left || !right) return false;
  return Math.abs(left.getTime() - right.getTime()) <= days * 24 * 60 * 60 * 1000;
}

function refMatches(row: StatementRow, item: ReturnType<typeof candidate>) {
  const text = `${row.reference} ${row.description}`.toLowerCase();
  return Boolean(item.voucherNumber && text.includes(item.voucherNumber.toLowerCase())) || Boolean(item.note && text.includes(item.note.toLowerCase().slice(0, 24)));
}
