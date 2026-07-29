import { AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export function AccountingErrorState({ title, description }: { title: string; description: string }) {
  return (
    <PageShell title={title} description={description}>
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Accounting data needs review</p>
            <p className="mt-1 opacity-85">The page could not calculate one statement from the current data. Check recently added payments, expenses, funds, fiscal years, or opening balances for invalid dates or amounts, then refresh.</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
