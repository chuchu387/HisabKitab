import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

export function StatCard({ label, value, currency }: { label: string; value: number; currency?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b-0 bg-transparent pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="break-words text-xl font-semibold text-foreground sm:text-2xl">{currency ? money(value) : value.toLocaleString()}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary/70" />
        </div>
      </CardContent>
    </Card>
  );
}
