import { Types } from "mongoose";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { GeneralFund } from "@/models/GeneralFund";
import { User } from "@/models/User";

export type ReportFilters = {
  organizationId: string;
  from?: string;
  to?: string;
  projectId?: string;
  categoryId?: string;
};

function expenseMatch(filters: ReportFilters) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(filters.organizationId), $and: [approvedExpenseCondition()] };
  if (filters.from || filters.to) {
    match.expenseDate = {};
    if (filters.from) (match.expenseDate as Record<string, Date>).$gte = new Date(filters.from);
    if (filters.to) (match.expenseDate as Record<string, Date>).$lte = new Date(filters.to);
  }
  if (filters.projectId) match.projectId = new Types.ObjectId(filters.projectId);
  if (filters.categoryId) match.categoryId = new Types.ObjectId(filters.categoryId);
  return match;
}

function approvedExpenseCondition() {
  return { $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] };
}

export async function getAccountingSummary(organizationId: string) {
  const oid = new Types.ObjectId(organizationId);
  const [organization, budgetAgg, paymentAgg, fundAgg, projectExpenseAgg, generalExpenseAgg, pendingExpenses, activeProjects, totalProjects] = await Promise.all([
    Organization.findById(organizationId).lean(),
    Project.aggregate([{ $match: { organizationId: oid } }, { $group: { _id: null, total: { $sum: "$totalBudget" }, legacyReceived: { $sum: { $ifNull: ["$receivedAmount", 0] } } } }]),
    ProjectPayment.aggregate([{ $match: { organizationId: oid } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    GeneralFund.aggregate([{ $match: { organizationId: oid } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { organizationId: oid, projectId: { $ne: null }, ...approvedExpenseCondition() } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { organizationId: oid, projectId: null, ...approvedExpenseCondition() } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.countDocuments({ organizationId, approvalStatus: "pending" }),
    Project.countDocuments({ organizationId, status: "active" }),
    Project.countDocuments({ organizationId })
  ]);
  const totalBudget = budgetAgg[0]?.total ?? 0;
  const totalReceived = paymentAgg[0]?.count ? paymentAgg[0].total : (budgetAgg[0]?.legacyReceived ?? 0);
  const projectExpenses = projectExpenseAgg[0]?.total ?? 0;
  const generalExpenses = generalExpenseAgg[0]?.total ?? 0;
  const generalBudget = fundAgg[0]?.count ? fundAgg[0].total : ((organization as any)?.generalBudget ?? 0);
  return {
    totalProjects,
    activeProjects,
    totalBudget,
    totalReceived,
    totalFunding: totalReceived + generalBudget,
    generalBudget,
    projectExpenses,
    generalExpenses,
    totalExpenses: projectExpenses + generalExpenses,
    pendingExpenses,
    dueAmount: totalBudget - totalReceived,
    remainingBudget: totalReceived - projectExpenses,
    projectPaidBalance: totalReceived - projectExpenses,
    generalBudgetBalance: generalBudget - generalExpenses,
    receivableRemaining: totalBudget - totalReceived,
    cashAfterExpenses: totalReceived - projectExpenses,
    organizationCashBalance: totalReceived + generalBudget - projectExpenses - generalExpenses
  };
}

export async function getProjectFinancials(organizationId: string, projectId: string) {
  const [project, paymentAgg, agg, pendingAgg] = await Promise.all([
    Project.findOne({ _id: projectId, organizationId }).populate("createdBy").lean(),
    ProjectPayment.aggregate([{ $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId) } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId), ...approvedExpenseCondition() } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId), approvalStatus: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);
  const safeProject = project as any;
  const expense = agg[0]?.total ?? 0;
  const received = paymentAgg[0]?.count ? paymentAgg[0].total : (safeProject?.receivedAmount ?? 0);
  return {
    project: safeProject,
    expense,
    received,
    remaining: (safeProject?.totalBudget ?? 0) - expense,
    receivableRemaining: (safeProject?.totalBudget ?? 0) - received,
    cashAfterExpenses: received - expense,
    pendingExpenseAmount: pendingAgg[0]?.total ?? 0,
    pendingExpenseCount: pendingAgg[0]?.count ?? 0
  };
}

export async function getDashboardCharts(organizationId: string) {
  const oid = new Types.ObjectId(organizationId);
  const [byCategory, byProject, monthly, budgetVsExpense] = await Promise.all([
    Expense.aggregate([
      { $match: { organizationId: oid, ...approvedExpenseCondition() } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "_id", foreignField: "_id", as: "category" } },
      { $project: { name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] }, amount: 1, _id: 0 } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, projectId: { $ne: null }, ...approvedExpenseCondition() } },
      { $group: { _id: "$projectId", amount: { $sum: "$amount" } } },
      { $lookup: { from: Project.collection.name, localField: "_id", foreignField: "_id", as: "project" } },
      { $project: { name: { $ifNull: [{ $first: "$project.name" }, "Unknown"] }, amount: 1, _id: 0 } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: oid, ...approvedExpenseCondition() } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } }, amount: { $sum: "$amount" } } },
      { $project: { month: "$_id", amount: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]),
    Project.aggregate([
      { $match: { organizationId: oid } },
      { $lookup: { from: ProjectPayment.collection.name, localField: "_id", foreignField: "projectId", as: "payments" } },
      { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
      { $project: { name: 1, budget: "$totalBudget", received: { $cond: [{ $gt: [{ $size: "$payments" }, 0] }, { $sum: "$payments.amount" }, { $ifNull: ["$receivedAmount", 0] }] }, expense: { $sum: { $map: { input: { $filter: { input: "$expenses", as: "expense", cond: { $or: [{ $eq: ["$$expense.approvalStatus", "approved"] }, { $eq: [{ $type: "$$expense.approvalStatus" }, "missing"] }] } } }, as: "expense", in: "$$expense.amount" } } }, _id: 0 } },
      { $limit: 10 }
    ])
  ]);
  return { byCategory, byProject, monthly, budgetVsExpense };
}

export async function getReports(filters: ReportFilters) {
  const match = expenseMatch(filters);
  const [summary, projects, expenses, categorySummary, monthlySummary, expenseTypeSummary] = await Promise.all([
    getAccountingSummary(filters.organizationId),
    Project.aggregate([
      { $match: { organizationId: new Types.ObjectId(filters.organizationId) } },
      { $lookup: { from: ProjectPayment.collection.name, localField: "_id", foreignField: "projectId", as: "payments" } },
      { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
      { $project: { name: 1, code: 1, budget: "$totalBudget", received: { $cond: [{ $gt: [{ $size: "$payments" }, 0] }, { $sum: "$payments.amount" }, { $ifNull: ["$receivedAmount", 0] }] }, expense: { $sum: { $map: { input: { $filter: { input: "$expenses", as: "expense", cond: { $or: [{ $eq: ["$$expense.approvalStatus", "approved"] }, { $eq: [{ $type: "$$expense.approvalStatus" }, "missing"] }] } } }, as: "expense", in: "$$expense.amount" } } } } },
      { $addFields: { remaining: { $subtract: ["$budget", "$expense"] }, receivableRemaining: { $subtract: ["$budget", "$received"] }, cashAfterExpenses: { $subtract: ["$received", "$expense"] } } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "categoryId", foreignField: "_id", as: "category" } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $project: { expenseDate: 1, description: 1, amount: 1, category: { $first: "$category.name" }, project: { $ifNull: [{ $first: "$project.name" }, "General"] } } },
      { $sort: { expenseDate: -1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "_id", foreignField: "_id", as: "category" } },
      { $project: { name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] }, amount: 1, count: 1, _id: 0 } },
      { $sort: { amount: -1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { month: "$_id", amount: 1, count: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { $cond: [{ $eq: ["$projectId", null] }, "General", "Project"] }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { name: "$_id", amount: 1, count: 1, _id: 0 } }
    ])
  ]);
  return { summary, projects, expenses, categorySummary, monthlySummary, expenseTypeSummary };
}

export type ContributorFilters = ReportFilters & {
  contributorId?: string;
  expenseType?: "project" | "general";
};

function contributorExpenseMatch(filters: ContributorFilters) {
  const match = expenseMatch(filters);
  if (filters.contributorId) match.createdBy = new Types.ObjectId(filters.contributorId);
  if (filters.expenseType === "project") match.projectId = { $ne: null };
  if (filters.expenseType === "general") match.projectId = null;
  return match;
}

export async function getExpenseContributorSummaries(organizationId: string, currentUserId?: string) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
  if (currentUserId) match.createdBy = new Types.ObjectId(currentUserId);
  return Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$createdBy",
        totalAmount: { $sum: "$amount" },
        expenseCount: { $sum: 1 },
        projectAmount: { $sum: { $cond: [{ $ne: ["$projectId", null] }, "$amount", 0] } },
        generalAmount: { $sum: { $cond: [{ $eq: ["$projectId", null] }, "$amount", 0] } },
        latestExpenseDate: { $max: "$expenseDate" }
      }
    },
    { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "user" } },
    {
      $project: {
        userId: "$_id",
        name: { $ifNull: [{ $first: "$user.name" }, "Unknown"] },
        email: { $first: "$user.email" },
        role: { $first: "$user.role" },
        totalAmount: 1,
        expenseCount: 1,
        projectAmount: 1,
        generalAmount: 1,
        latestExpenseDate: 1,
        _id: 0
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
}

export async function getExpenseContributorDetail(filters: ContributorFilters) {
  const match = contributorExpenseMatch(filters);
  const contributor = await User.findOne({ _id: filters.contributorId, organizationId: filters.organizationId }).lean();
  const [totals, categorySummary, projectSummary, monthlySummary, expenses] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          expenseCount: { $sum: 1 },
          projectAmount: { $sum: { $cond: [{ $ne: ["$projectId", null] }, "$amount", 0] } },
          generalAmount: { $sum: { $cond: [{ $eq: ["$projectId", null] }, "$amount", 0] } },
          latestExpenseDate: { $max: "$expenseDate" }
        }
      }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "_id", foreignField: "_id", as: "category" } },
      { $project: { name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] }, amount: 1, count: 1, _id: 0 } },
      { $sort: { amount: -1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$projectId", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: Project.collection.name, localField: "_id", foreignField: "_id", as: "project" } },
      { $project: { name: { $ifNull: [{ $first: "$project.name" }, "General"] }, amount: 1, count: 1, _id: 0 } },
      { $sort: { amount: -1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { month: "$_id", amount: 1, count: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $lookup: { from: ExpenseCategory.collection.name, localField: "categoryId", foreignField: "_id", as: "category" } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $project: { expenseDate: 1, description: 1, amount: 1, category: { $first: "$category.name" }, project: { $ifNull: [{ $first: "$project.name" }, "General"] } } },
      { $sort: { expenseDate: -1 } }
    ])
  ]);
  return {
    contributor,
    totals: totals[0] ?? { totalAmount: 0, expenseCount: 0, projectAmount: 0, generalAmount: 0, latestExpenseDate: null },
    categorySummary,
    projectSummary,
    monthlySummary,
    expenses
  };
}
