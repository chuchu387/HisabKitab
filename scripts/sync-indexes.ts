import { existsSync, readFileSync } from "node:fs";
import { connectToDatabase } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { AttendanceSetting } from "@/models/AttendanceSetting";
import { ApInvoice } from "@/models/ApInvoice";
import { AuditLog } from "@/models/AuditLog";
import { BankAccount } from "@/models/BankAccount";
import { BankReconciliation } from "@/models/BankReconciliation";
import { Campaign } from "@/models/Campaign";
import { ChartAccount } from "@/models/ChartAccount";
import { ChatGroup } from "@/models/ChatGroup";
import { ChatMessage } from "@/models/ChatMessage";
import { Client } from "@/models/Client";
import { FiscalYear } from "@/models/FiscalYear";
import { Expense } from "@/models/Expense";
import { ExpenseApprovalHistory } from "@/models/ExpenseApprovalHistory";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { GeneralFund } from "@/models/GeneralFund";
import { EmailLog } from "@/models/EmailLog";
import { Invoice } from "@/models/Invoice";
import { Lead } from "@/models/Lead";
import { LeadActivity } from "@/models/LeadActivity";
import { LeadTask } from "@/models/LeadTask";
import { Leave } from "@/models/Leave";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";
import { Notification } from "@/models/Notification";
import { Organization } from "@/models/Organization";
import { OpeningBalance } from "@/models/OpeningBalance";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { Payroll } from "@/models/Payroll";
import { Product } from "@/models/Product";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { ProjectTask } from "@/models/ProjectTask";
import { Proposal } from "@/models/Proposal";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { PushSubscription } from "@/models/PushSubscription";
import { SalarySetting } from "@/models/SalarySetting";
import { SalesTarget } from "@/models/SalesTarget";
import { SalesOrder } from "@/models/SalesOrder";
import { Commission } from "@/models/Commission";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";

function loadLocalEnv() {
  for (const file of [".env.production", ".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  }
}

async function main() {
  loadLocalEnv();
  await connectToDatabase();
  const models = [
    Organization,
    User,
    Client,
    Project,
    ExpenseCategory,
    Expense,
    ExpenseApprovalHistory,
    AuditLog,
    ProjectPayment,
    GeneralFund,
    ProjectTask,
    TaskFolder,
    Notification,
    PasswordResetToken,
    EmailLog,
    ChartAccount,
    FiscalYear,
    Invoice,
    SalesOrder,
    PurchaseOrder,
    ApInvoice,
    BankAccount,
    BankReconciliation,
    OpeningBalance,
    ManualJournalEntry,
    Attendance,
    AttendanceSetting,
    Leave,
    Payroll,
    SalarySetting,
    Campaign,
    Lead,
    LeadActivity,
    LeadTask,
    Product,
    Proposal,
    SalesTarget,
    Commission,
    ChatGroup,
    ChatMessage,
    PushSubscription
  ];
  for (const model of models) {
    await model.syncIndexes();
    console.log(`Synced indexes for ${model.modelName}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
