import { Types } from "mongoose";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { BankAccount } from "@/models/BankAccount";
import { nepalFiscalYearForDate, nepalFiscalYearOptions, nepalFiscalYearRange } from "@/services/nepal-fiscal-year";
import { paymentAccountingStages } from "@/services/project-payment-accounting";

const taxRate = 0.25;

export type FinancialStatementFilters = {
  organizationId: string;
  from?: string;
  to?: string;
};

export function fiscalYearOptions(now = new Date()) {
  return nepalFiscalYearOptions(now);
}

export function fiscalYearForDate(date: Date) {
  return nepalFiscalYearForDate(date);
}

export function fiscalYearRange(startYear: number) {
  return nepalFiscalYearRange(startYear);
}

export async function getFinancialStatements(filters: FinancialStatementFilters) {
  const oid = new Types.ObjectId(filters.organizationId);
  const currentFY = fiscalYearForDate(new Date());
  const from = parseDateOr(filters.from, currentFY.startDate);
  const to = endOfDay(parseDateOr(filters.to, currentFY.endDate));
  const period = { $gte: from, $lte: to };
  const throughEnd = { $lte: to };

  const [
    periodProjectPayments,
    periodGeneralFunds,
    periodExpenseByType,
    periodExpenseByCategory,
    periodExpenseByProject,
    allProjectPaymentsToDate,
    allGeneralFundsToDate,
    allExpensesToDate,
    bankAccounts,
    clientProjects
  ] = await Promise.all([
    ProjectPayment.aggregate([
      { $match: { organizationId: oid, paymentDate: period } },
      ...paymentAccountingStages(),
      { $group: { _id: null, total: { $sum: "$serviceAmountForAccounting" }, cash: { $sum: "$amount" }, vat: { $sum: "$vatPortionForAccounting" }, count: { $sum: 1 } } }
    ]),
    GeneralFund.aggregate([{ $match: { organizationId: oid, fundDate: period } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([
      { $match: { organizationId: oid, expenseDate: period, approvalStatus: "approved" } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      {
        $project: {
          amount: 1,
          typeName: {
            $cond: [
              { $eq: ["$projectId", null] },
              "general",
              { $cond: [{ $eq: [{ $ifNull: [{ $first: "$project.projectType" }, "client"] }, "internal"] }, "internal_project", "client_project"] }
            ]
          }
        }
      },
      { $group: { _id: "$typeName", total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, expenseDate: period, approvalStatus: "approved" } },
      { $lookup: { from: "expensecategories", localField: "categoryId", foreignField: "_id", as: "category" } },
      { $group: { _id: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { name: "$_id", total: 1, count: 1, _id: 0 } },
      { $sort: { total: -1 } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, expenseDate: period, approvalStatus: "approved", projectId: { $ne: null } } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $group: { _id: "$projectId", total: { $sum: "$amount" }, projectName: { $first: { $first: "$project.name" } }, projectCode: { $first: { $first: "$project.code" } } } },
      { $project: { projectName: 1, projectCode: 1, total: 1, _id: 0 } },
      { $sort: { total: -1 } }
    ]),
    ProjectPayment.aggregate([
      { $match: { organizationId: oid, paymentDate: throughEnd } },
      ...paymentAccountingStages(),
      { $group: { _id: "$projectId", total: { $sum: "$serviceAmountForAccounting" }, cash: { $sum: "$amount" }, vat: { $sum: "$vatPortionForAccounting" } } }
    ]),
    GeneralFund.aggregate([{ $match: { organizationId: oid, fundDate: throughEnd } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { organizationId: oid, expenseDate: throughEnd, approvalStatus: "approved" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    BankAccount.find({ organizationId: oid }).select("openingBalance").lean(),
    Project.find({ organizationId: oid, projectType: "client", totalBudget: { $gt: 0 } }).select("name code totalBudget receivedAmount").lean()
  ]);

  const paymentToDateByProject = new Map(allProjectPaymentsToDate.map((row: any) => [row._id?.toString?.(), row.total]));
  const receivableRows = (clientProjects as any[]).map((project) => {
    const paidToDate = effectiveReceived(project.receivedAmount ?? 0, paymentToDateByProject.get(project._id.toString()) ?? 0);
    return {
      projectId: project._id.toString(),
      projectName: project.name,
      projectCode: project.code,
      budget: round(project.totalBudget ?? 0),
      received: round(paidToDate),
      due: round(Math.max((project.totalBudget ?? 0) - paidToDate, 0))
    };
  }).filter((project) => project.due > 0);

  const revenue = round(periodProjectPayments[0]?.total ?? 0);
  const cashReceived = round(periodProjectPayments[0]?.cash ?? revenue);
  const outputVatCollected = round(periodProjectPayments[0]?.vat ?? 0);
  const ownerFunds = round(periodGeneralFunds[0]?.total ?? 0);
  const clientProjectExpenses = round(typeTotal(periodExpenseByType, "client_project"));
  const internalProjectExpenses = round(typeTotal(periodExpenseByType, "internal_project"));
  const generalExpenses = round(typeTotal(periodExpenseByType, "general"));
  const totalExpenses = round(clientProjectExpenses + internalProjectExpenses + generalExpenses);
  const grossProfit = round(revenue - clientProjectExpenses);
  const netProfitBeforeTax = round(revenue - totalExpenses);
  const estimatedTaxPayable = round(Math.max(netProfitBeforeTax, 0) * taxRate);
  const netProfitAfterTax = round(netProfitBeforeTax - estimatedTaxPayable);

  const allPaymentsTotal = round(allProjectPaymentsToDate.reduce((sum: number, row: any) => sum + (row.cash ?? 0), 0));
  const outputVatCollectedToDate = round(allProjectPaymentsToDate.reduce((sum: number, row: any) => sum + (row.vat ?? 0), 0));
  const allGeneralFundsTotal = round(allGeneralFundsToDate[0]?.total ?? 0);
  const allExpensesTotal = round(allExpensesToDate[0]?.total ?? 0);
  const bankOpeningBalance = round((bankAccounts as any[]).reduce((sum, account) => sum + (account.openingBalance ?? 0), 0));
  const cashAtBank = round(bankOpeningBalance + allPaymentsTotal + allGeneralFundsTotal - allExpensesTotal);
  const accountsReceivable = round(receivableRows.reduce((sum, project) => sum + project.due, 0));
  const totalAssets = round(cashAtBank + accountsReceivable);
  const totalLiabilities = round(estimatedTaxPayable + outputVatCollectedToDate);
  const ownerEquity = round(totalAssets - totalLiabilities);

  return {
    period: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      label: `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`
    },
    summary: {
      revenue,
      cashReceived,
      ownerFunds,
      clientProjectExpenses,
      internalProjectExpenses,
      generalExpenses,
      totalExpenses,
      grossProfit,
      netProfitBeforeTax,
      estimatedTaxPayable,
      outputVatCollected,
      outputVatCollectedToDate,
      netProfitAfterTax,
      bankOpeningBalance,
      cashAtBank,
      accountsReceivable,
      totalAssets,
      totalLiabilities,
      ownerEquity
    },
    balanceSheet: {
      assets: [
        { account: "Cash / Bank Balance", amount: cashAtBank },
        { account: "Accounts Receivable", amount: accountsReceivable }
      ],
      liabilities: [
        { account: "Output VAT Payable", amount: outputVatCollectedToDate },
        { account: "Estimated Tax Provision", amount: estimatedTaxPayable },
        { account: "Accounts Payable", amount: 0 }
      ],
      equity: [
        { account: "Owner/Other Funds To Date", amount: allGeneralFundsTotal },
        { account: "Retained Earnings / Balancing Equity", amount: round(ownerEquity - allGeneralFundsTotal) }
      ]
    },
    profitAndLoss: [
      { account: "Client Project Revenue", amount: revenue },
      { account: "Direct Client Project Expenses", amount: -clientProjectExpenses },
      { account: "Gross Profit", amount: grossProfit },
      { account: "Internal Project Expenses", amount: -internalProjectExpenses },
      { account: "General/Admin Expenses", amount: -generalExpenses },
      { account: "Net Profit Before Tax", amount: netProfitBeforeTax },
      { account: "Estimated Tax Provision", amount: -estimatedTaxPayable },
      { account: "Net Profit After Tax", amount: netProfitAfterTax }
    ],
    cashFlow: [
      { account: "Opening Cash / Bank Balance", amount: bankOpeningBalance },
      { account: "Client Payments Received", amount: cashReceived },
      { account: "Owner/Other Funds Received", amount: ownerFunds },
      { account: "Approved Expenses Paid", amount: -totalExpenses },
      { account: "Net Cash Movement In Period", amount: round(cashReceived + ownerFunds - totalExpenses) },
      { account: "Cash / Bank Balance At Period End", amount: cashAtBank }
    ],
    trialBalance: closingTrialBalance(cashAtBank, accountsReceivable, totalLiabilities, ownerEquity),
    expenseByCategory: periodExpenseByCategory,
    expenseByProject: periodExpenseByProject,
    receivables: receivableRows
  };
}

function typeTotal(rows: any[], key: string) {
  return rows.find((row) => row._id === key)?.total ?? 0;
}

function effectiveReceived(projectReceived: number, paymentTotal: number) {
  return projectReceived > 0 ? projectReceived : paymentTotal;
}

function endOfDay(date: Date) {
  if (Number.isNaN(date.getTime())) return new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDateOr(value: string | undefined, fallback: Date) {
  if (!value) return new Date(fallback);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function round(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function closingTrialBalance(cashAtBank: number, accountsReceivable: number, taxPayable: number, ownerEquity: number) {
  return [
    { accountCode: "1000", accountName: "Cash / Bank", debit: cashAtBank >= 0 ? cashAtBank : 0, credit: cashAtBank < 0 ? Math.abs(cashAtBank) : 0 },
    { accountCode: "1100", accountName: "Accounts Receivable", debit: accountsReceivable, credit: 0 },
    { accountCode: "2000", accountName: "Tax Payable", debit: 0, credit: taxPayable },
    { accountCode: "3000", accountName: "Owner Equity / Retained Earnings", debit: ownerEquity < 0 ? Math.abs(ownerEquity) : 0, credit: ownerEquity >= 0 ? ownerEquity : 0 }
  ].filter((row) => row.debit !== 0 || row.credit !== 0);
}
