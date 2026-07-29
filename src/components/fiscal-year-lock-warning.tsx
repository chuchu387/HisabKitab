import { AlertTriangle } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { FiscalYear } from "@/models/FiscalYear";
import { dateInput } from "@/lib/utils";

export async function FiscalYearLockWarning({ organizationId }: { organizationId: string }) {
  await connectToDatabase();
  const closedYears = await FiscalYear.find({ organizationId, status: "closed" }).sort({ endDate: -1 }).limit(2).lean();
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">Fiscal year lock is active</p>
        <p className="mt-1 text-xs opacity-85">
          Entries dated inside a closed fiscal year cannot be created, edited, deleted, approved, or reconciled.
          {closedYears.length > 0 && ` Latest closed: ${closedYears.map((year: any) => `${year.name} (${dateInput(year.startDate)} to ${dateInput(year.endDate)})`).join(", ")}.`}
        </p>
      </div>
    </div>
  );
}
