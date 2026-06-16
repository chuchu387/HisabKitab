import bcrypt from "bcryptjs";
import { loadEnvFile } from "node:process";
import { connectToDatabase } from "../src/lib/db";
import { defaultCategories } from "../src/constants";
import { Organization } from "../src/models/Organization";
import { User } from "../src/models/User";
import { Project } from "../src/models/Project";
import { ExpenseCategory } from "../src/models/ExpenseCategory";
import { Expense } from "../src/models/Expense";
import { AuditLog } from "../src/models/AuditLog";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();
  await Promise.all([Organization.deleteMany({}), User.deleteMany({}), Project.deleteMany({}), ExpenseCategory.deleteMany({}), Expense.deleteMany({}), AuditLog.deleteMany({})]);
  const password = await bcrypt.hash("Password123!", 12);
  const organization = await Organization.create({ name: "Acme Finance", code: "ACME", email: "finance@acme.test", phone: "+1 555 0100", address: "100 Market Street", status: "active" });
  const superAdmin = await User.create({ name: "Super Admin", email: "super@expense.test", password, role: "super_admin", active: true });
  const owner = await User.create({ organizationId: organization._id, name: "Acme Owner", email: "owner@acme.test", password, role: "owner", active: true });
  await User.create({ organizationId: organization._id, name: "Acme Admin", email: "admin@acme.test", password, role: "admin", active: true });
  await User.create({ organizationId: organization._id, name: "Acme Staff", email: "staff@acme.test", password, role: "staff", active: true });
  const categories = await ExpenseCategory.insertMany(defaultCategories.map((name) => ({ organizationId: organization._id, name, active: true })));
  const project = await Project.create({
    organizationId: organization._id,
    name: "ERP Rollout",
    code: "ERP-001",
    description: "Internal accounting modernization project",
    totalBudget: 85000,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    status: "active",
    createdBy: owner._id
  });
  await Expense.create([
    { organizationId: organization._id, projectId: project._id, categoryId: categories[3]._id, amount: 4200, expenseDate: new Date("2026-05-01"), description: "Laptops for rollout team", createdBy: owner._id },
    { organizationId: organization._id, projectId: null, categoryId: categories[4]._id, amount: 950, expenseDate: new Date("2026-05-15"), description: "Office supplies", createdBy: owner._id }
  ]);
  await AuditLog.create({ organizationId: organization._id, userId: owner._id, action: "Project Created", entityType: "Project", entityId: project._id, metadata: { seeded: true } });
  console.log("Seed complete");
  console.log("Super Admin: super@expense.test / Password123!");
  console.log("Owner: owner@acme.test / Password123!");
  console.log(`Seeded by ${superAdmin.email}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
