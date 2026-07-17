import { loadEnvFile } from "node:process";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import { Expense } from "../src/models/Expense";
import { GeneralFund } from "../src/models/GeneralFund";
import { Project } from "../src/models/Project";
import { ProjectPayment } from "../src/models/ProjectPayment";

loadEnvFile(".env.local");

async function sumProjectPayments(organizationId: string, projectId: string) {
  const [row] = await ProjectPayment.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return row?.total ?? 0;
}

async function sumProjectExpenses(organizationId: string, projectId: string) {
  const [row] = await Expense.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId), approvalStatus: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return row?.total ?? 0;
}

async function main() {
  await connectToDatabase();
  const projects = (await Project.find({}).sort({ projectType: 1, name: 1 }).lean()) as any[];
  let totalBudget = 0;
  let totalEffectiveReceived = 0;
  let totalPaymentHistory = 0;
  let totalProjectExpenses = 0;

  console.log("PROJECT AUDIT");
  for (const project of projects) {
    const payments = await sumProjectPayments(project.organizationId.toString(), project._id.toString());
    const expenses = await sumProjectExpenses(project.organizationId.toString(), project._id.toString());
    const received = (project.receivedAmount ?? 0) > 0 ? project.receivedAmount : payments;
    totalBudget += project.totalBudget ?? 0;
    totalEffectiveReceived += received;
    totalPaymentHistory += payments;
    totalProjectExpenses += expenses;
    console.log([
      project.name,
      project.projectType ?? "client",
      `budget=${project.totalBudget ?? 0}`,
      `receivedField=${project.receivedAmount ?? 0}`,
      `payments=${payments}`,
      `effectiveReceived=${received}`,
      `approvedExpense=${expenses}`,
      `balance=${Number((received - expenses).toFixed(2))}`
    ].join(" | "));
  }

  const [generalExpenses] = await Expense.aggregate([
    { $match: { projectId: null, approvalStatus: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const [funds] = await GeneralFund.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
  const ownerOtherFunds = funds?.total ?? 0;
  const approvedGeneralExpenses = generalExpenses?.total ?? 0;
  const companyCashBalance = totalEffectiveReceived + ownerOtherFunds - totalProjectExpenses - approvedGeneralExpenses;

  console.log("TOTAL AUDIT");
  console.log({
    totalBudget: Number(totalBudget.toFixed(2)),
    totalEffectiveReceived: Number(totalEffectiveReceived.toFixed(2)),
    totalPaymentHistory: Number(totalPaymentHistory.toFixed(2)),
    ownerOtherFunds: Number(ownerOtherFunds.toFixed(2)),
    approvedProjectExpenses: Number(totalProjectExpenses.toFixed(2)),
    approvedGeneralExpenses: Number(approvedGeneralExpenses.toFixed(2)),
    companyCashBalance: Number(companyCashBalance.toFixed(2))
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
