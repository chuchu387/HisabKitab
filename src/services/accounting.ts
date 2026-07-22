import { Types } from "mongoose";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { GeneralFund } from "@/models/GeneralFund";
import { User } from "@/models/User";
import { Client } from "@/models/Client";

export type ReportFilters = {
  organizationId: string;
  from?: string;
  to?: string;
  projectId?: string;
  categoryId?: string;
};

function toObjectId(value?: string) {
  return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function dateRange(from?: string, to?: string) {
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : null;
}

function expenseMatch(filters: ReportFilters) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(filters.organizationId), $and: [approvedExpenseCondition()] };
  const range = dateRange(filters.from, filters.to);
  const projectId = toObjectId(filters.projectId);
  const categoryId = toObjectId(filters.categoryId);
  if (range) match.expenseDate = range;
  if (filters.projectId) match.projectId = projectId ?? { $exists: false };
  if (filters.categoryId) match.categoryId = categoryId ?? { $exists: false };
  return match;
}

function approvedExpenseCondition() {
  return { approvalStatus: "approved" };
}

function pendingExpenseCondition() {
  return { $or: [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }] };
}

function effectiveReceived(projectReceived: number, paymentTotal: number) {
  return projectReceived > 0 ? projectReceived : paymentTotal;
}

function currency(value: number) {
  return Number(value.toFixed(2));
}

export async function getAccountingSummary(organizationId: string) {
  const oid = new Types.ObjectId(organizationId);
  const [organization, projectTotals, fundAgg, projectExpenseAgg, projectExpenseByType, generalExpenseAgg, pendingExpenses, activeProjects, totalProjects] = await Promise.all([
    Organization.findById(organizationId).lean(),
    Project.aggregate([
      { $match: { organizationId: oid } },
      { $lookup: { from: ProjectPayment.collection.name, localField: "_id", foreignField: "projectId", as: "payments" } },
      {
        $project: {
          totalBudget: 1,
          received: { $cond: [{ $gt: [{ $ifNull: ["$receivedAmount", 0] }, 0] }, { $ifNull: ["$receivedAmount", 0] }, { $sum: "$payments.amount" }] }
        }
      },
      { $group: { _id: null, totalBudget: { $sum: "$totalBudget" }, totalReceived: { $sum: "$received" } } }
    ]),
    GeneralFund.aggregate([{ $match: { organizationId: oid } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { organizationId: oid, projectId: { $ne: null }, ...approvedExpenseCondition() } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([
      { $match: { organizationId: oid, projectId: { $ne: null }, ...approvedExpenseCondition() } },
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $project: { amount: 1, projectType: { $ifNull: [{ $first: "$project.projectType" }, "client"] } } },
      { $group: { _id: "$projectType", total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([{ $match: { organizationId: oid, projectId: null, ...approvedExpenseCondition() } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.countDocuments({ organizationId, ...pendingExpenseCondition() }),
    Project.countDocuments({ organizationId, status: "active" }),
    Project.countDocuments({ organizationId })
  ]);
  const totalBudget = currency(projectTotals[0]?.totalBudget ?? 0);
  const totalReceived = currency(projectTotals[0]?.totalReceived ?? 0);
  const projectExpenses = currency(projectExpenseAgg[0]?.total ?? 0);
  const clientProjectExpenses = currency(projectExpenseByType.find((row: any) => row._id === "client")?.total ?? 0);
  const internalProjectExpenses = currency(projectExpenseByType.find((row: any) => row._id === "internal")?.total ?? 0);
  const generalExpenses = currency(generalExpenseAgg[0]?.total ?? 0);
  const generalBudget = currency(fundAgg[0]?.count ? fundAgg[0].total : ((organization as any)?.generalBudget ?? 0));
  return {
    totalProjects,
    activeProjects,
    totalBudget,
    totalReceived,
    totalFunding: currency(totalReceived + generalBudget),
    generalBudget,
    projectExpenses,
    clientProjectExpenses,
    internalProjectExpenses,
    generalExpenses,
    totalExpenses: currency(projectExpenses + generalExpenses),
    pendingExpenses,
    dueAmount: currency(totalBudget - totalReceived),
    remainingBudget: currency(totalReceived - projectExpenses),
    projectPaidBalance: currency(totalReceived - projectExpenses),
    generalBudgetBalance: currency(generalBudget - generalExpenses),
    receivableRemaining: currency(totalBudget - totalReceived),
    cashAfterExpenses: currency(totalReceived - projectExpenses),
    organizationCashBalance: currency(totalReceived + generalBudget - projectExpenses - generalExpenses)
  };
}

export async function getProjectFinancials(organizationId: string, projectId: string) {
  const [project, paymentAgg, agg, pendingAgg] = await Promise.all([
    Project.findOne({ _id: projectId, organizationId }).populate("createdBy clientId").lean(),
    ProjectPayment.aggregate([{ $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId) } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId), ...approvedExpenseCondition() } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId), ...pendingExpenseCondition() } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);
  const safeProject = project as any;
  const expense = currency(agg[0]?.total ?? 0);
  const received = currency(effectiveReceived(safeProject?.receivedAmount ?? 0, paymentAgg[0]?.total ?? 0));
  return {
    project: safeProject,
    expense,
    received,
    remaining: currency((safeProject?.totalBudget ?? 0) - expense),
    receivableRemaining: currency((safeProject?.totalBudget ?? 0) - received),
    cashAfterExpenses: currency(received - expense),
    pendingExpenseAmount: currency(pendingAgg[0]?.total ?? 0),
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
      { $project: { name: 1, budget: "$totalBudget", received: { $cond: [{ $gt: [{ $ifNull: ["$receivedAmount", 0] }, 0] }, { $ifNull: ["$receivedAmount", 0] }, { $sum: "$payments.amount" }] }, expense: { $sum: { $map: { input: { $filter: { input: "$expenses", as: "expense", cond: { $eq: ["$$expense.approvalStatus", "approved"] } } }, as: "expense", in: "$$expense.amount" } } }, _id: 0 } },
      { $limit: 10 }
    ])
  ]);
  return { byCategory, byProject, monthly, budgetVsExpense };
}

export async function getReports(filters: ReportFilters) {
  const match = expenseMatch(filters);
  const oid = new Types.ObjectId(filters.organizationId);
  const selectedProjectId = toObjectId(filters.projectId);
  const range = dateRange(filters.from, filters.to);
  const projectScope: Record<string, unknown> = { organizationId: oid };
  if (filters.projectId) projectScope._id = selectedProjectId ?? { $exists: false };
  const paymentMatch: Record<string, unknown> = { organizationId: oid };
  if (filters.projectId) paymentMatch.projectId = selectedProjectId ?? { $exists: false };
  if (range) paymentMatch.paymentDate = range;
  const fundMatch: Record<string, unknown> = { organizationId: oid };
  if (range) fundMatch.fundDate = range;
  const expenseProjectMatch = { ...match, projectId: filters.projectId ? (selectedProjectId ?? { $exists: false }) : { $ne: null } };

  const [
    organization,
    projectDocs,
    paymentAgg,
    fundAgg,
    totalFundDocs,
    projectExpenseAgg,
    generalExpenseAgg,
    pendingExpenses,
    expenses,
    categorySummary,
    monthlySummary,
    expenseTypeSummary
  ] = await Promise.all([
    Organization.findById(filters.organizationId).lean(),
    Project.find(projectScope).populate({ path: "clientId", model: Client, select: "name code" }).sort({ name: 1 }).lean(),
    ProjectPayment.aggregate([{ $match: paymentMatch }, { $group: { _id: "$projectId", total: { $sum: "$amount" } } }]),
    GeneralFund.aggregate([{ $match: fundMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    GeneralFund.countDocuments({ organizationId: filters.organizationId }),
    Expense.aggregate([{ $match: expenseProjectMatch }, { $group: { _id: "$projectId", total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { ...match, projectId: null } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.countDocuments({ organizationId: filters.organizationId, ...pendingExpenseCondition() }),
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
      { $lookup: { from: Project.collection.name, localField: "projectId", foreignField: "_id", as: "project" } },
      { $project: { amount: 1, typeName: { $cond: [{ $eq: ["$projectId", null] }, "General", { $cond: [{ $eq: [{ $ifNull: [{ $first: "$project.projectType" }, "client"] }, "internal"] }, "Internal Project", "Client Project"] }] } } },
      { $group: { _id: "$typeName", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { name: "$_id", amount: 1, count: 1, _id: 0 } }
    ])
  ]);

  const paymentByProject = new Map(paymentAgg.map((row: any) => [String(row._id), row.total]));
  const expenseByProject = new Map(projectExpenseAgg.map((row: any) => [String(row._id), row.total]));
  const projects = projectDocs.map((project: any) => {
    const budget = currency(project.totalBudget ?? 0);
    const paymentTotal = range ? currency(paymentByProject.get(String(project._id)) ?? 0) : 0;
    const received = currency(range ? paymentTotal : effectiveReceived(project.receivedAmount ?? 0, paymentByProject.get(String(project._id)) ?? 0));
    const expense = currency(expenseByProject.get(String(project._id)) ?? 0);
    return {
      _id: project._id,
      name: project.name,
      code: project.code,
      projectType: project.projectType ?? "client",
      clientId: project.clientId?._id?.toString?.() ?? null,
      clientName: project.clientId?.name ?? (project.projectType === "internal" ? "Internal" : "No Client"),
      clientCode: project.clientId?.code ?? "",
      budget,
      received,
      expense,
      remaining: currency(budget - expense),
      receivableRemaining: currency(budget - received),
      cashAfterExpenses: currency(received - expense)
    };
  });

  const totalBudget = currency(projects.reduce((sum: number, project: any) => sum + project.budget, 0));
  const totalReceived = currency(projects.reduce((sum: number, project: any) => sum + project.received, 0));
  const projectExpenses = currency(projects.reduce((sum: number, project: any) => sum + project.expense, 0));
  const clientProjectExpenses = currency(projects.filter((project: any) => project.projectType !== "internal").reduce((sum: number, project: any) => sum + project.expense, 0));
  const internalProjectExpenses = currency(projects.filter((project: any) => project.projectType === "internal").reduce((sum: number, project: any) => sum + project.expense, 0));
  const generalExpenses = currency(filters.projectId ? 0 : (generalExpenseAgg[0]?.total ?? 0));
  const generalBudget = currency(filters.projectId ? 0 : (totalFundDocs === 0 && !range ? ((organization as any)?.generalBudget ?? 0) : (fundAgg[0]?.total ?? 0)));
  const summary = {
    totalProjects: projects.length,
    activeProjects: projectDocs.filter((project: any) => project.status === "active").length,
    totalBudget,
    totalReceived,
    totalFunding: currency(totalReceived + generalBudget),
    generalBudget,
    projectExpenses,
    clientProjectExpenses,
    internalProjectExpenses,
    generalExpenses,
    totalExpenses: currency(projectExpenses + generalExpenses),
    pendingExpenses,
    dueAmount: currency(totalBudget - totalReceived),
    remainingBudget: currency(totalReceived - projectExpenses),
    projectPaidBalance: currency(totalReceived - projectExpenses),
    generalBudgetBalance: currency(generalBudget - generalExpenses),
    receivableRemaining: currency(totalBudget - totalReceived),
    cashAfterExpenses: currency(totalReceived - projectExpenses),
    organizationCashBalance: currency(totalReceived + generalBudget - projectExpenses - generalExpenses)
  };
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
