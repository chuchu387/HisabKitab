"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Attendance } from "@/models/Attendance";
import { Commission } from "@/models/Commission";
import { Payroll } from "@/models/Payroll";
import { SalarySetting } from "@/models/SalarySetting";
import { User } from "@/models/User";
import { AttendanceSetting } from "@/models/AttendanceSetting";

function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
  return { start, end };
}

async function workingDaysInMonth(month: string, organizationId: string) {
  const { start, end } = monthRange(month);
  const now = new Date();
  const lastDay = end.getTime() < now.getTime() ? end : now;
  const settings: any = await AttendanceSetting.findOne({ organizationId }).lean();
  const working = settings?.workingDays?.length ? settings.workingDays.map(Number) : [0, 1, 2, 3, 4, 5];
  const holidays = new Set((settings?.holidays ?? []).map(String));
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= lastDay.getTime()) {
    const day = cursor.getUTCDay();
    const date = cursor.toISOString().slice(0, 10);
    if (working.includes(day) && !holidays.has(date)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(count, 1);
}

function sumAmounts(items: { label?: string; amount?: number }[]) {
  return (items ?? []).reduce((total, item) => total + (Number(item.amount) || 0), 0);
}

export async function generatePayroll(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    const month = formData.get("month") as string;
    if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "Invalid month" };
    const userIds = formData.getAll("userIds").map(String);
    if (!userIds.length) return { ok: false, message: "Select at least one staff member" };
    const { start, end } = monthRange(month);
    const workingDays = await workingDaysInMonth(month, organizationId);

    const [users, settings, commissions, attendance] = await Promise.all([
      User.find({ organizationId, active: true, _id: { $in: userIds } }).sort({ name: 1 }).select("name role").lean() as unknown as any[],
      SalarySetting.find({ organizationId, userId: { $in: userIds } }).lean() as unknown as any[],
      Commission.find({ organizationId, userId: { $in: userIds }, status: "paid", paidAt: { $gte: start, $lte: end } }).select("userId commissionAmount").lean() as unknown as any[],
      Attendance.find({ organizationId, userId: { $in: userIds }, date: { $gte: month + "-01", $lte: month + "-31" } }).select("userId date").lean() as unknown as any[]
    ]);

    const settingsByUser = new Map(settings.map((setting) => [setting.userId.toString(), setting]));
    const commissionByUser = new Map<string, number>();
    for (const item of commissions) commissionByUser.set(item.userId.toString(), (commissionByUser.get(item.userId.toString()) ?? 0) + item.commissionAmount);
    const presentByUser = new Map<string, Set<string>>();
    for (const item of attendance) {
      if (!presentByUser.has(item.userId.toString())) presentByUser.set(item.userId.toString(), new Set());
      presentByUser.get(item.userId.toString())!.add(item.date);
    }

    let created = 0;
    let skipped = 0;
    for (const user of users) {
      const existing = await Payroll.findOne({ organizationId, month, userId: user._id });
      if (existing) { skipped++; continue; }
      const setting = settingsByUser.get(user._id.toString());
      const baseSalary = Number(setting?.baseSalary) || 0;
      const allowances = setting?.allowances ?? [];
      const presentDays = presentByUser.get(user._id.toString())?.size ?? 0;
      const basePay = presentDays > 0 ? Math.round((baseSalary * presentDays) / workingDays) : baseSalary;
      const allowanceTotal = sumAmounts(allowances);
      const commission = commissionByUser.get(user._id.toString()) ?? 0;
      const overtimeHours = Number(formData.get("overtimeHours") || 0) || 0;
      const overtimeRate = Number(setting?.overtimeRate) || 0;
      const bonus = 0;
      const deductions: { label: string; amount: number }[] = [];
      const advanceDeduction = Number(formData.get("advanceDeduction") || 0) || 0;
      const overtimePay = overtimeHours * overtimeRate;
      const grossPay = basePay + allowanceTotal + bonus + commission + overtimePay;
      const totalDeductions = sumAmounts(deductions) + advanceDeduction;
      const netPay = Math.max(grossPay - totalDeductions, 0);
      await Payroll.create({
        organizationId,
        userId: user._id,
        month,
        baseSalary: basePay,
        allowances,
        bonus,
        overtimeHours,
        overtimeRate,
        commission,
        deductions,
        advanceDeduction,
        presentDays,
        workingDays,
        grossPay,
        totalDeductions,
        netPay,
        status: "draft",
        createdBy: session.user.userId
      });
      created++;
    }
    revalidatePath("/payroll");
    const message = created > 0 ? `Generated ${created} payslip${created > 1 ? "s" : ""}` : "No new payslips to generate";
    if (skipped > 0) revalidatePath("/payroll");
    return { ok: true, message: skipped > 0 ? `${message} (${skipped} already exist)` : message };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Failed to generate payroll" };
  }
}

export async function savePayslip(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    const id = formData.get("id") as string;
    const payslip = await Payroll.findOne({ _id: id, organizationId });
    if (!payslip) return { ok: false, message: "Payslip not found" };
    if (payslip.status === "paid") return { ok: false, message: "Paid payslips cannot be edited" };

    const allowanceLabels = formData.getAll("allowanceLabels").map(String);
    const allowanceAmounts = formData.getAll("allowanceAmounts").map((value) => Number(value) || 0);
    const deductionLabels = formData.getAll("deductionLabels").map(String);
    const deductionAmounts = formData.getAll("deductionAmounts").map((value) => Number(value) || 0);
    const allowances = allowanceLabels.map((label, index) => ({ label, amount: allowanceAmounts[index] ?? 0 })).filter((item) => item.label || item.amount > 0);
    const deductions = deductionLabels.map((label, index) => ({ label, amount: deductionAmounts[index] ?? 0 })).filter((item) => item.label || item.amount > 0);

    const bonus = Number(formData.get("bonus") || 0) || 0;
    const overtimeHours = Number(formData.get("overtimeHours") || 0) || 0;
    const overtimeRate = Number(formData.get("overtimeRate") || 0) || 0;
    const advanceDeduction = Number(formData.get("advanceDeduction") || 0) || 0;
    const notes = String(formData.get("notes") || "");

    const overtimePay = overtimeHours * overtimeRate;
    const grossPay = (payslip.baseSalary || 0) + sumAmounts(allowances) + bonus + (payslip.commission || 0) + overtimePay;
    const totalDeductions = sumAmounts(deductions) + advanceDeduction;
    const netPay = Math.max(grossPay - totalDeductions, 0);

    payslip.allowances = allowances;
    payslip.deductions = deductions;
    payslip.bonus = bonus;
    payslip.overtimeHours = overtimeHours;
    payslip.overtimeRate = overtimeRate;
    payslip.advanceDeduction = advanceDeduction;
    payslip.grossPay = grossPay;
    payslip.totalDeductions = totalDeductions;
    payslip.netPay = netPay;
    payslip.notes = notes;
    await payslip.save();
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${id}`);
    return { ok: true, message: "Payslip updated" };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Failed to save payslip" };
  }
}

export async function setPayslipStatus(id: string, status: "approved" | "paid"): Promise<{ ok: boolean; message: string }> {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const payslip = await Payroll.findOne({ _id: id, organizationId });
  if (!payslip) return { ok: false, message: "Payslip not found" };
  if (status === "approved") payslip.status = "approved";
  if (status === "paid") { payslip.status = "paid"; payslip.paidAt = new Date(); }
  await payslip.save();
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
  return { ok: true, message: status === "paid" ? "Marked as paid" : "Payslip approved" };
}

export async function deletePayslip(id: string): Promise<{ ok: boolean }> {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  await Payroll.deleteOne({ _id: id, organizationId });
  revalidatePath("/payroll");
  return { ok: true };
}

export async function saveSalarySetting(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    const userId = String(formData.get("userId") || "");
    if (!userId) return { ok: false, message: "Select a staff member" };
    const allowanceLabels = formData.getAll("allowanceLabels").map(String);
    const allowanceAmounts = formData.getAll("allowanceAmounts").map((value) => Number(value) || 0);
    const allowances = allowanceLabels.map((label, index) => ({ label, amount: allowanceAmounts[index] ?? 0 })).filter((item) => item.label || item.amount > 0);
    const data = {
      organizationId,
      userId,
      baseSalary: Number(formData.get("baseSalary") || 0) || 0,
      allowances,
      overtimeRate: Number(formData.get("overtimeRate") || 0) || 0,
      notes: String(formData.get("notes") || ""),
      createdBy: session.user.userId
    };
    await SalarySetting.findOneAndUpdate({ organizationId, userId }, data, { upsert: true });
    revalidatePath("/payroll/settings");
    return { ok: true, message: "Salary setting saved" };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Failed to save salary setting" };
  }
}

export async function getPayrollData(organizationId: string, month: string) {
  await connectToDatabase();
  const users = await User.find({ organizationId, active: true, role: { $in: ["staff", "admin"] } }).sort({ name: 1 }).select("name role").lean();
  const settings = await SalarySetting.find({ organizationId }).lean();
  const payslips = await Payroll.find({ organizationId, month }).populate("userId", "name").lean();
  const settingsByUser = new Map(settings.map((setting) => [setting.userId.toString(), setting]));
  return {
    users: JSON.parse(JSON.stringify(users)),
    settingsByUser: JSON.parse(JSON.stringify(Object.fromEntries(settingsByUser))),
    payslips: JSON.parse(JSON.stringify(payslips))
  };
}
