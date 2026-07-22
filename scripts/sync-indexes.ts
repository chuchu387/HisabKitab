import { existsSync, readFileSync } from "node:fs";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { Client } from "@/models/Client";
import { Expense } from "@/models/Expense";
import { ExpenseApprovalHistory } from "@/models/ExpenseApprovalHistory";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { GeneralFund } from "@/models/GeneralFund";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
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
  const models = [Organization, User, Client, Project, ExpenseCategory, Expense, ExpenseApprovalHistory, AuditLog, ProjectPayment, GeneralFund, ProjectTask];
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
