import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

export function StatCard({ label, value, currency }: { label: string; value: number; currency?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{currency ? money(value) : value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
