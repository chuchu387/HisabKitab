const fiscalStartMonth = 6;
const fiscalStartDay = 17;

export type NepalFiscalYearRange = {
  label: string;
  bsStartYear: number;
  from: string;
  to: string;
  startDate: Date;
  endDate: Date;
};

export function nepalFiscalYearForDate(date = new Date()) {
  const year = date.getUTCFullYear();
  const startThisYear = new Date(Date.UTC(year, fiscalStartMonth, fiscalStartDay));
  return nepalFiscalYearRange(date >= startThisYear ? year : year - 1);
}

export function nepalFiscalYearRange(adStartYear: number): NepalFiscalYearRange {
  const startDate = new Date(Date.UTC(adStartYear, fiscalStartMonth, fiscalStartDay));
  const endDate = new Date(Date.UTC(adStartYear + 1, fiscalStartMonth, fiscalStartDay - 1, 23, 59, 59, 999));
  const bsStartYear = adStartYear + 57;
  return {
    label: `FY ${bsStartYear}/${String(bsStartYear + 1).slice(-2)}`,
    bsStartYear,
    from: startDate.toISOString().slice(0, 10),
    to: endDate.toISOString().slice(0, 10),
    startDate,
    endDate
  };
}

export function nepalFiscalYearOptions(now = new Date()) {
  const current = nepalFiscalYearForDate(now);
  const currentAdStartYear = current.startDate.getFullYear();
  return Array.from({ length: 8 }, (_, index) => nepalFiscalYearRange(currentAdStartYear - index));
}

export function previousNepalFiscalYear(now = new Date()) {
  const current = nepalFiscalYearForDate(now);
  return nepalFiscalYearRange(current.startDate.getFullYear() - 1);
}
