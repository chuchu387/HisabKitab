import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { AuditLog } from "@/models/AuditLog";
import { BankAccount } from "@/models/BankAccount";
import { BankReconciliation } from "@/models/BankReconciliation";
import { ChartAccount } from "@/models/ChartAccount";
import { Client } from "@/models/Client";
import { Expense } from "@/models/Expense";
import { ExpenseApprovalHistory } from "@/models/ExpenseApprovalHistory";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { FiscalYear } from "@/models/FiscalYear";
import { GeneralFund } from "@/models/GeneralFund";
import { Invoice } from "@/models/Invoice";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";
import { Notification } from "@/models/Notification";
import { OpeningBalance } from "@/models/OpeningBalance";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";

export async function GET() {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const scoped = { organizationId };
  const [organization, users, projects, clients, categories, expenses, expenseApprovalHistory, payments, generalFunds, invoices, tasks, bankAccounts, reconciliations, chartAccounts, openingBalances, journals, fiscalYears, notifications, auditLogs] = await Promise.all([
    Organization.findById(organizationId).lean(),
    User.find(scoped).select("-password").lean(),
    Project.find(scoped).lean(),
    Client.find(scoped).lean(),
    ExpenseCategory.find(scoped).lean(),
    Expense.find(scoped).lean(),
    ExpenseApprovalHistory.find(scoped).lean(),
    ProjectPayment.find(scoped).lean(),
    GeneralFund.find(scoped).lean(),
    Invoice.find(scoped).lean(),
    ProjectTask.find(scoped).lean(),
    BankAccount.find(scoped).lean(),
    BankReconciliation.find(scoped).lean(),
    ChartAccount.find(scoped).lean(),
    OpeningBalance.find(scoped).lean(),
    ManualJournalEntry.find(scoped).lean(),
    FiscalYear.find(scoped).lean(),
    Notification.find(scoped).lean(),
    AuditLog.find(scoped).sort({ createdAt: -1 }).limit(5000).lean()
  ]);
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    organization,
    users,
    projects,
    clients,
    categories,
    expenses,
    expenseApprovalHistory,
    payments,
    generalFunds,
    invoices,
    tasks,
    bankAccounts,
    reconciliations,
    chartAccounts,
    openingBalances,
    journals,
    fiscalYears,
    notifications,
    auditLogs
  }, null, 2);
  return new NextResponse(payload, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="hisabkitab-organization-export-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
