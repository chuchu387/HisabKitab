import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { Types } from "mongoose";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | null | undefined) {
  const amount = Number(value);
  return `Rs. ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy-MM-dd");
}

export function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) return value.toString();
  return String(value);
}

export function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isObjectId(value: unknown) {
  return typeof value === "string" && Types.ObjectId.isValid(value as string);
}

export function safeObjectId(value: unknown) {
  return isObjectId(value) ? new Types.ObjectId(value as string) : null;
}

export function safeDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateInput(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}
