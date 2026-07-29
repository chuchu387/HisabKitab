import { Types } from "mongoose";
import { BankAccount } from "@/models/BankAccount";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
import { ProjectPayment } from "@/models/ProjectPayment";

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

function totalMap(rows: any[]) {
  return new Map(rows.map((row) => [row._id?.toString?.(), row.total ?? 0]));
}

function round(value: number) {
  return Number(value.toFixed(2));
}
