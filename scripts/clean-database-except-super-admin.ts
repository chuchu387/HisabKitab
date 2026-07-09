import { loadEnvFile } from "node:process";
import { connectToDatabase } from "../src/lib/db";
import { AuditLog } from "../src/models/AuditLog";
import { Expense } from "../src/models/Expense";
import { ExpenseCategory } from "../src/models/ExpenseCategory";
import { Organization } from "../src/models/Organization";
import { Project } from "../src/models/Project";
import { ProjectPayment } from "../src/models/ProjectPayment";
import { GeneralFund } from "../src/models/GeneralFund";
import { ProjectTask } from "../src/models/ProjectTask";
import { User } from "../src/models/User";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();

  const [organizations, projects, payments, funds, tasks, categories, expenses, auditLogs, nonSuperAdmins] = await Promise.all([
    Organization.deleteMany({}),
    Project.deleteMany({}),
    ProjectPayment.deleteMany({}),
    GeneralFund.deleteMany({}),
    ProjectTask.deleteMany({}),
    ExpenseCategory.deleteMany({}),
    Expense.deleteMany({}),
    AuditLog.deleteMany({}),
    User.deleteMany({ role: { $ne: "super_admin" } })
  ]);

  const superAdmins = await User.updateMany(
    { role: "super_admin" },
    {
      $set: { active: true },
      $unset: { organizationId: "" }
    }
  );

  console.log("Database cleaned except Super Admin users");
  console.log(`Organizations deleted: ${organizations.deletedCount}`);
  console.log(`Projects deleted: ${projects.deletedCount}`);
  console.log(`Project payments deleted: ${payments.deletedCount}`);
  console.log(`General funds deleted: ${funds.deletedCount}`);
  console.log(`Project tasks deleted: ${tasks.deletedCount}`);
  console.log(`Categories deleted: ${categories.deletedCount}`);
  console.log(`Expenses deleted: ${expenses.deletedCount}`);
  console.log(`Audit logs deleted: ${auditLogs.deletedCount}`);
  console.log(`Non-super-admin users deleted: ${nonSuperAdmins.deletedCount}`);
  console.log(`Super Admin users preserved: ${superAdmins.matchedCount}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
