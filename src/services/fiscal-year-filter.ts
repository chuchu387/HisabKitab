import { dateInput, safeDate } from "@/lib/utils";
import { nepalFiscalYearForDate, nepalFiscalYearOptions } from "@/services/nepal-fiscal-year";

export type FiscalYearFilterOption = {
  value: string;
  label: string;
  from: string;
  to: string;
  source: "saved" | "generated";
};

export function buildFiscalYearFilterOptions(savedYears: any[]): FiscalYearFilterOption[] {
  const savedOptions = savedYears.map((year) => ({
    value: `saved:${year._id.toString()}`,
    label: `${year.name}${year.status ? ` (${year.status})` : ""}`,
    from: dateInput(year.startDate),
    to: dateInput(year.endDate),
    source: "saved" as const
  }));
  const seenRanges = new Set(savedOptions.map((option) => `${option.from}:${option.to}`));
  const generatedOptions = nepalFiscalYearOptions()
    .filter((option) => !seenRanges.has(`${option.from}:${option.to}`))
    .map((option) => ({
      value: `generated:${option.label}`,
      label: option.label,
      from: option.from,
      to: option.to,
      source: "generated" as const
    }));
  return [...savedOptions, ...generatedOptions];
}

export function resolveFiscalYearFilter(options: FiscalYearFilterOption[], value: unknown) {
  if (typeof value !== "string" || !value || value === "all" || value === "custom") return null;
  return options.find((option) => option.value === value || option.label === value) ?? null;
}

export function dateRangeForFiscalYearFilter(options: FiscalYearFilterOption[], value: unknown, from: unknown, to: unknown) {
  const selected = resolveFiscalYearFilter(options, value);
  if (selected) return { from: safeDate(selected.from), to: safeDate(selected.to), selected };
  if (value === "custom" || from || to) return { from: safeDate(from), to: safeDate(to), selected: null };
  return { from: null, to: null, selected: null };
}

export function fiscalYearLabelForDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : nepalFiscalYearForDate(date).label;
}
