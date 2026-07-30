import { Types } from "mongoose";
import { BankAccount } from "@/models/BankAccount";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { GeneralFund } from "@/models/GeneralFund";
import { Invoice } from "@/models/Invoice";
import { OpeningBalance } from "@/models/OpeningBalance";
import { Organization } from "@/models/Organization";
import { ProjectPayment } from "@/models/ProjectPayment";
import { getFinancialStatements } from "@/services/financial-statements";

export type HealthSeverity = "critical" | "warning" | "info";

export type HealthIssue = {
  severity: HealthSeverity;
  area: string;
  title: string;
  detail: string;
  href: string;
  count?: number;
};

export async function getDataHealth(organizationId: string) {
  const oid = new Types.ObjectId(organizationId);
  const now = new Date();
  const [organization, fiscalYears] = await Promise.all([
    Organization.findById(organizationId).select("vatRegistered vatEffectiveDate defaultVatRate").lean() as any,
    FiscalYear.find({ organizationId }).sort({ startDate: 1 }).lean()
  ]);
  const [statements, bankOpening, cashOpeningBalances, pendingExpenses, missingExpenseBank, missingPaymentBank, missingFundBank, overdueInvoices, vatMissingInvoices, noFiscalYearCounts] = await Promise.all([
    getFinancialStatements({ organizationId }),
    BankAccount.aggregate([{ $match: { organizationId: oid, openingBalance: { $ne: 0 } } }, { $group: { _id: null, total: { $sum: "$openingBalance" }, count: { $sum: 1 } } }]),
    OpeningBalance.countDocuments({
      organizationId,
      $or: [
        { accountCode: "1000" },
        { accountName: /cash|bank|wallet/i }
      ]
    }),
    Expense.countDocuments({ organizationId, $or: [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }] }),
    Expense.countDocuments({ organizationId, approvalStatus: "approved", $or: [{ bankAccountId: null }, { bankAccountId: { $exists: false } }] }),
    ProjectPayment.countDocuments({ organizationId, $or: [{ bankAccountId: null }, { bankAccountId: { $exists: false } }] }),
    GeneralFund.countDocuments({ organizationId, $or: [{ bankAccountId: null }, { bankAccountId: { $exists: false } }] }),
    Invoice.countDocuments({ organizationId, status: { $in: ["sent", "partial"] }, dueDate: { $lt: now }, $expr: { $lt: [{ $ifNull: ["$paidAmount", 0] }, { $ifNull: ["$total", 0] }] } }),
    countVatMissingInvoices(organizationId, organization),
    countTransactionsOutsideFiscalYears(organizationId, fiscalYears)
  ]);

  const issues: HealthIssue[] = [];
  const bankOpeningCount = bankOpening[0]?.count ?? 0;
  if (bankOpeningCount > 0 && cashOpeningBalances > 0) {
    issues.push({
      severity: "critical",
      area: "Opening Balances",
      title: "Possible duplicate cash opening",
      detail: "Bank Accounts already contain opening balances. Cash/bank Opening Balance rows can double-count starting cash.",
      href: "/opening-balances",
      count: cashOpeningBalances
    });
  }
  if ((statements.summary.cashAtBank ?? 0) < 0) {
    issues.push({
      severity: "critical",
      area: "Cash",
      title: "Company cash is negative",
      detail: "Approved expenses are higher than recorded bank opening, project cash received, and owner/other funds.",
      href: "/dashboard",
      count: 1
    });
  }
  if (pendingExpenses > 0) {
    issues.push({ severity: "warning", area: "Expenses", title: "Expenses pending approval", detail: "Pending expenses are not included in finalized accounts until approved.", href: "/expenses?approvalStatus=pending", count: pendingExpenses });
  }
  if (missingExpenseBank > 0) {
    issues.push({ severity: "warning", area: "Expenses", title: "Approved expenses missing bank account", detail: "Add bank/cash account to expenses for stronger reconciliation and audit trace.", href: "/expenses", count: missingExpenseBank });
  }
  if (missingPaymentBank > 0) {
    issues.push({ severity: "warning", area: "Payments", title: "Project payments missing bank account", detail: "Payments without bank account are harder to reconcile with statements.", href: "/project-payments", count: missingPaymentBank });
  }
  if (missingFundBank > 0) {
    issues.push({ severity: "warning", area: "Funds", title: "Owner/other funds missing bank account", detail: "Attach bank/cash account to every fund entry for audit trail.", href: "/general-funds", count: missingFundBank });
  }
  if (overdueInvoices > 0) {
    issues.push({ severity: "warning", area: "Invoices", title: "Overdue unpaid invoices", detail: "Follow up or record payment against these invoices.", href: "/invoices?status=overdue", count: overdueInvoices });
  }
  if (vatMissingInvoices > 0) {
    issues.push({ severity: "warning", area: "Tax", title: "VAT may be missing on invoices", detail: "Organization is VAT registered, but some invoices after VAT effective date have VAT disabled.", href: "/invoices", count: vatMissingInvoices });
  }
  if (noFiscalYearCounts.total > 0) {
    issues.push({ severity: "critical", area: "Fiscal Years", title: "Transactions outside configured fiscal years", detail: "Create/open fiscal years that cover all payment, fund, invoice, and expense dates.", href: "/fiscal-years", count: noFiscalYearCounts.total });
  }
  if (!issues.length) {
    issues.push({ severity: "info", area: "System", title: "No audit blockers found", detail: "Core accounting records pass the current data-health checks.", href: "/accounts", count: 0 });
  }

  return {
    generatedAt: now,
    summary: {
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
      bankOpeningBalance: bankOpening[0]?.total ?? 0,
      cashAtBank: statements.summary.cashAtBank ?? 0,
      transactionsOutsideFiscalYears: noFiscalYearCounts.total
    },
    issues
  };
}

async function countVatMissingInvoices(organizationId: string, organization: any) {
  if (!organization?.vatRegistered) return 0;
  const effectiveDate = organization.vatEffectiveDate ? new Date(organization.vatEffectiveDate) : null;
  const query: Record<string, unknown> = { organizationId, status: { $ne: "void" }, vatApplicable: { $ne: true } };
  if (effectiveDate) query.invoiceDate = { $gte: effectiveDate };
  return Invoice.countDocuments(query);
}

async function countTransactionsOutsideFiscalYears(organizationId: string, fiscalYears: any[]) {
  if (!fiscalYears.length) {
    const [expenses, payments, funds, invoices] = await Promise.all([
      Expense.countDocuments({ organizationId }),
      ProjectPayment.countDocuments({ organizationId }),
      GeneralFund.countDocuments({ organizationId }),
      Invoice.countDocuments({ organizationId })
    ]);
    return { expenses, payments, funds, invoices, total: expenses + payments + funds + invoices };
  }
  const [expenses, payments, funds, invoices] = await Promise.all([
    countOutsideDateRange(Expense, organizationId, "expenseDate", fiscalYears),
    countOutsideDateRange(ProjectPayment, organizationId, "paymentDate", fiscalYears),
    countOutsideDateRange(GeneralFund, organizationId, "fundDate", fiscalYears),
    countOutsideDateRange(Invoice, organizationId, "invoiceDate", fiscalYears)
  ]);
  return { expenses, payments, funds, invoices, total: expenses + payments + funds + invoices };
}

function countOutsideDateRange(model: any, organizationId: string, dateField: string, fiscalYears: any[]) {
  return model.countDocuments({
    organizationId,
    $and: fiscalYears.map((year) => ({
      $or: [
        { [dateField]: { $lt: year.startDate } },
        { [dateField]: { $gt: year.endDate } }
      ]
    }))
  });
}
