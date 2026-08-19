import { Types } from "mongoose";
import { safeObjectId } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter } from "@/services/fiscal-year-filter";

export async function buildExpenseFilterQuery(params: Record<string, string | string[] | undefined>, organizationId: string, session: { user: { userId: string; role: string } }) {
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  const q = typeof params?.q === "string" ? params.q : "";
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  if (q) query.description = new RegExp(q, "i");
  if (session.user.role === "staff") {
    query.createdBy = new Types.ObjectId(session.user.userId);
  } else if (params?.submittedBy) {
    const submittedBy = safeObjectId(params.submittedBy);
    if (submittedBy) query.createdBy = submittedBy;
  }
  if (fyRange.from || fyRange.to) {
    query.expenseDate = {};
    if (fyRange.from) query.expenseDate.$gte = fyRange.from;
    if (fyRange.to) {
      const end = fyRange.to;
      end.setHours(23, 59, 59, 999);
      query.expenseDate.$lte = end;
    }
    if (!Object.keys(query.expenseDate).length) delete query.expenseDate;
  }
  if (params?.projectId === "general") {
    query.projectId = null;
  } else if (params?.projectId) {
    const projectId = safeObjectId(params.projectId);
    if (projectId) query.projectId = projectId;
  }
  if (params?.expenseType === "project") query.projectId = { $ne: null };
  if (params?.expenseType === "general") query.projectId = null;
  if (params?.approvalStatus === "approved") query.approvalStatus = "approved";
  if (params?.approvalStatus === "pending") query.$or = [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }];
  if (params?.approvalStatus === "rejected") query.approvalStatus = "rejected";
  if (params?.categoryId) {
    const categoryId = safeObjectId(params.categoryId);
    if (categoryId) query.categoryId = categoryId;
  }
  return { query, fiscalYearOptions, selectedFY };
}