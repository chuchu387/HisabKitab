import { Types } from "mongoose";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";

export type ReportFilters = {
  organizationId: string;
  from?: string;
  to?: string;
  projectId?: string;
  categoryId?: string;
};

function expenseMatch(filters: ReportFilters) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(filters.organizationId) };
  if (filters.from || filters.to) {
    match.expenseDate = {};
    if (filters.from) (match.expenseDate as Record<string, Date>).$gte = new Date(filters.from);
    if (filters.to) (match.expenseDate as Record<string, Date>).$lte = new Date(filters.to);
  }
  if (filters.projectId) match.projectId = new Types.ObjectId(filters.projectId);
  if (filters.categoryId) match.categoryId = new Types.ObjectId(filters.categoryId);
  return match;
}

export async function getAccountingSummary(organizationId: string) {
  const [budgetAgg, projectExpenseAgg, generalExpenseAgg, activeProjects, totalProjects] = await Promise.all([
    Project.aggregate([{ $match: { organizationId: new Types.ObjectId(organizationId) } }, { $group: { _id: null, total: { $sum: "$totalBudget" }, received: { $sum: { $ifNull: ["$receivedAmount", 0] } } } }]),
    Expense.aggregate([{ $match: { organizationId: new Types.ObjectId(organizationId), projectId: { $ne: null } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { organizationId: new Types.ObjectId(organizationId), projectId: null } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Project.countDocuments({ organizationId, status: "active" }),
    Project.countDocuments({ organizationId })
  ]);
  const totalBudget = budgetAgg[0]?.total ?? 0;
  const totalReceived = budgetAgg[0]?.received ?? 0;
  const projectExpenses = projectExpenseAgg[0]?.total ?? 0;
  const generalExpenses = generalExpenseAgg[0]?.total ?? 0;
  return {
    totalProjects,
    activeProjects,
    totalBudget,
    totalReceived,
    projectExpenses,
    generalExpenses,
    totalExpenses: projectExpenses + generalExpenses,
    dueAmount: totalBudget - totalReceived,
    remainingBudget: totalReceived - projectExpenses,
    receivableRemaining: totalBudget - totalReceived,
    cashAfterExpenses: totalReceived - projectExpenses
  };
}

export async function getProjectFinancials(organizationId: string, projectId: string) {
  const [project, agg] = await Promise.all([
    Project.findOne({ _id: projectId, organizationId }).lean(),
    Expense.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);
  const safeProject = project as any;
  const expense = agg[0]?.total ?? 0;
  const received = safeProject?.receivedAmount ?? 0;
  return {
    project: safeProject,
    expense,
    received,
    remaining: (safeProject?.totalBudget ?? 0) - expense,
    receivableRemaining: (safeProject?.totalBudget ?? 0) - received,
    cashAfterExpenses: received - expense
  };
}

export async function getDashboardCharts(organizationId: string) {
  const oid = new Types.ObjectId(organizationId);
  const [byCategory, byProject, monthly, budgetVsExpense] = await Promise.all([
    Expense.aggregate([
      { $match: { organizationId: oid } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "_id", foreignField: "_id", as: "category" } },
      { $project: { name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] }, amount: 1, _id: 0 } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, projectId: { $ne: null } } },
      { $group: { _id: "$projectId", amount: { $sum: "$amount" } } },
      { $lookup: { from: Project.collection.name, localField: "_id", foreignField: "_id", as: "project" } },
      { $project: { name: { $ifNull: [{ $first: "$project.name" }, "Unknown"] }, amount: 1, _id: 0 } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } }, amount: { $sum: "$amount" } } },
      { $project: { month: "$_id", amount: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]),
    Project.aggregate([
      { $match: { organizationId: oid } },
      { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
      { $project: { name: 1, budget: "$totalBudget", received: { $ifNull: ["$receivedAmount", 0] }, expense: { $sum: "$expenses.amount" }, _id: 0 } },
      { $limit: 10 }
    ])
  ]);
  return { byCategory, byProject, monthly, budgetVsExpense };
}

export async function getReports(filters: ReportFilters) {
  const match = expenseMatch(filters);
  const [summary, projects, expenses] = await Promise.all([
    getAccountingSummary(filters.organizationId),
    Project.aggregate([
      { $match: { organizationId: new Types.ObjectId(filters.organizationId) } },
      { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
      { $project: { name: 1, code: 1, budget: "$totalBudget", received: { $ifNull: ["$receivedAmount", 0] }, expense: { $sum: "$expenses.amount" }, remaining: { $subtract: ["$totalBudget", { $sum: "$expenses.amount" }] }, receivableRemaining: { $subtract: ["$totalBudget", { $ifNull: ["$receivedAmount", 0] }] }, cashAfterExpenses: { $subtract: [{ $ifNull: ["$receivedAmount", 0] }, { $sum: "$expenses.amount" }] } } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "categoryId", foreignField: "_id", as: "category" } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $project: { expenseDate: 1, description: 1, amount: 1, category: { $first: "$category.name" }, project: { $ifNull: [{ $first: "$project.name" }, "General"] } } },
      { $sort: { expenseDate: -1 } }
    ])
  ]);
  return { summary, projects, expenses };
}
