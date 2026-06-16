import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | null | undefined) {
  return `Rs. ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(value ?? 0)}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "yyyy-MM-dd");
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
