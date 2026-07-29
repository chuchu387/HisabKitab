import type { Model } from "mongoose";
import { fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

const prefixByType = {
  expense: "EXP",
  projectPayment: "PAY",
  generalFund: "FUND",
  journal: "JV",
  reconciliation: "REC"
} as const;

export type VoucherType = keyof typeof prefixByType;

export async function nextVoucherNumber(model: Model<any>, organizationId: string, type: VoucherType, date: Date) {
  const fiscalYear = fiscalYearLabelForDate(date).replace(/[^0-9A-Za-z-]/g, "");
  const prefix = `${prefixByType[type]}-${fiscalYear}`;
  const latest = await model.findOne({ organizationId, voucherNumber: new RegExp(`^${escapeRegex(prefix)}-\\d+$`) }).sort({ voucherNumber: -1 }).select("voucherNumber").lean();
  const latestSequence = Number.parseInt(String((latest as any)?.voucherNumber ?? "").split("-").at(-1) ?? "0", 10);
  return `${prefix}-${String((Number.isFinite(latestSequence) ? latestSequence : 0) + 1).padStart(5, "0")}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
