"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LATE_THRESHOLD = 10; // 10 AM

export function AttendanceReportView({ data, month }: { data: any; month: string }) {
  const { users, records, totalDays } = data;
  const report = useMemo(() => {
    const byUser = new Map<string, Set<string>>();
    const lateByUser = new Map<string, number>();
    const checkInTimesByUser = new Map<string, string[]>();
    records.forEach((r: any) => {
      const uid = r.userId?.toString();
      if (!uid) return;
      if (!byUser.has(uid)) byUser.set(uid, new Set());
      byUser.get(uid)!.add(r.date);
      if (!lateByUser.has(uid)) lateByUser.set(uid, 0);
      const h = new Date(r.checkInTime).getHours();
      const m = new Date(r.checkInTime).getMinutes();
      if (h > LATE_THRESHOLD || (h === LATE_THRESHOLD && m > 0)) {
        lateByUser.set(uid, (lateByUser.get(uid) ?? 0) + 1);
      }
      if (!checkInTimesByUser.has(uid)) checkInTimesByUser.set(uid, []);
      checkInTimesByUser.get(uid)!.push(new Date(r.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    });
    return users.map((u: any) => ({
      ...u,
      present: byUser.get(u._id)?.size ?? 0,
      absent: totalDays - (byUser.get(u._id)?.size ?? 0),
      late: lateByUser.get(u._id) ?? 0,
      times: checkInTimesByUser.get(u._id) ?? []
    }));
  }, [users, records, totalDays]);
  const [prev, next] = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return [prevM, nextM];
  }, [month]);
  const overallPresent = report.reduce((s: number, r: any) => s + r.present, 0);
  const overallLate = report.reduce((s: number, r: any) => s + r.late, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/attendance/reports?month=${prev}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
        <span className="text-lg font-semibold">{month}</span>
        <Link href={`/attendance/reports?month=${next}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Present</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{overallPresent}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Absent</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalDays * users.length - overallPresent}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Late Check-ins</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{overallLate}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Member Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Member</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium text-right">Present</th>
                <th className="pb-2 pr-4 font-medium text-right">Absent</th>
                <th className="pb-2 pr-4 font-medium text-right">Late</th>
                <th className="pb-2 font-medium">Avg Check-in</th>
              </tr>
            </thead>
            <tbody>
              {report.map((u: any) => {
                const avgTime = u.times.length
                  ? u.times
                      .map((t: string) => {
                        const [h, m] = t.match(/\d+/g)!.map(Number);
                        const isPM = t.includes("PM");
                        return (isPM ? (h % 12) + 12 : h % 12) * 60 + m;
                      })
                      .reduce((a: number, b: number) => a + b, 0) / u.times.length
                  : 0;
                const avgStr = avgTime
                  ? `${String(Math.floor(avgTime / 60)).padStart(2, "0")}:${String(Math.round(avgTime % 60)).padStart(2, "0")}`
                  : "—";
                return (
                  <tr key={u._id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{u.name}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{u.role ?? "staff"}</td>
                    <td className="py-2 pr-4 text-right">{u.present}</td>
                    <td className={`py-2 pr-4 text-right ${u.absent > 0 ? "text-destructive" : ""}`}>{u.absent}</td>
                    <td className={`py-2 pr-4 text-right ${u.late > 0 ? "text-accent" : ""}`}>{u.late}</td>
                    <td className="py-2 text-muted-foreground">{avgStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!report.length && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <XCircle className="h-6 w-6" />
              <p className="text-sm">No data for this month</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
