import { FiscalYear } from "@/models/FiscalYear";

export async function assertFiscalYearOpen(organizationId: string, date: Date | string) {
  const target = new Date(date);
  const closed = await FiscalYear.findOne({
    organizationId,
    status: "closed",
    startDate: { $lte: target },
    endDate: { $gte: target }
  }).select("_id name").lean() as any;
  if (closed) throw new Error(`Fiscal year ${closed.name} is closed`);
}
