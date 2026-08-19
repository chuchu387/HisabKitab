"use client";

import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, XCircle, Download } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNepalTime, nepalDateEndMs } from "@/lib/timezone";

const LATE_THRESHOLD = 10;
const OT_THRESHOLD_MS = 8 * 60 * 60 * 1000;

function durationMs(r: any): number {
  const start = new Date(r.checkInTime).getTime();
  const rawEnd = new Date(r.checkOutTime).getTime();
  const end = Math.min(rawEnd, nepalDateEndMs(r.date));
  return Math.max(0, end - start);
}

export function AttendanceReportView({ data, month }: { data: any; month: string }) {
  const { users, records, leaves, totalDays } = data;
  const leaveDates = useMemo(() => new Set(leaves.map((l: any) => l.date + ":" + l.userId?.toString())), [leaves]);

  const report = useMemo(() => {
    const byUser = new Map<string, Set<string>>();
    const lateByUser = new Map<string, number>();
    const otByUser = new Map<string, number>();
    const hoursByUser = new Map<string, number>();
    const ipMap = new Map<string, string[]>();

    records.forEach((r: any) => {
      const uid = r.userId?.toString();
      if (!uid) return;
      if (!byUser.has(uid)) byUser.set(uid, new Set());
      if (!leaveDates.has(r.date + ":" + uid)) {
        byUser.get(uid)!.add(r.date);
      }
      if (!lateByUser.has(uid)) lateByUser.set(uid, 0);
      const [hStr, mStr] = new Date(r.checkInTime).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" }).split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (h > LATE_THRESHOLD || (h === LATE_THRESHOLD && m > 0)) {
        lateByUser.set(uid, (lateByUser.get(uid) ?? 0) + 1);
      }
      if (r.checkOutTime) {
        const ms = durationMs(r);
        if (ms > 0) {
          hoursByUser.set(uid, (hoursByUser.get(uid) ?? 0) + ms);
          if (ms > OT_THRESHOLD_MS) {
            otByUser.set(uid, (otByUser.get(uid) ?? 0) + 1);
          }
        }
      }
      if (r.ipAddress) {
        if (!ipMap.has(uid)) ipMap.set(uid, []);
        if (!ipMap.get(uid)!.includes(r.ipAddress)) ipMap.get(uid)!.push(r.ipAddress);
      }
    });

    return users.map((u: any) => {
      const totalMs = hoursByUser.get(u._id) ?? 0;
      const otCount = otByUser.get(u._id) ?? 0;
      const otMs = records
        .filter((r: any) => r.userId?.toString() === u._id && r.checkOutTime)
        .reduce((s: number, r: any) => {
          const ms = durationMs(r);
          return s + (ms > OT_THRESHOLD_MS ? ms - OT_THRESHOLD_MS : 0);
        }, 0);
      const otH = Math.floor(otMs / 3600000);
      const otM = Math.round((otMs % 3600000) / 60000);
      const totalH = Math.floor(totalMs / 3600000);
      const totalM = Math.round((totalMs % 3600000) / 60000);
      return {
        ...u,
        present: byUser.get(u._id)?.size ?? 0,
        absent: totalDays - (byUser.get(u._id)?.size ?? 0),
        late: lateByUser.get(u._id) ?? 0,
        otDays: otCount,
        otHours: otH > 0 || otM > 0 ? `${otH}h ${otM}m` : "—",
        totalHours: `${totalH}h ${totalM}m`,
        ips: ipMap.get(u._id) ?? []
      };
    });
  }, [users, records, leaveDates, totalDays]);

  const [prev, next] = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return [
      `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`,
      `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`
    ];
  }, [month]);

  const overallPresent = report.reduce((s: number, r: any) => s + r.present, 0);
  const overallLate = report.reduce((s: number, r: any) => s + r.late, 0);
  const overallOT = report.reduce((s: number, r: any) => s + r.otDays, 0);
  const totalHoursMs = records.reduce((s: number, r: any) => s + (r.checkOutTime ? Math.max(0, durationMs(r)) : 0), 0);
  const totalH = Math.floor(totalHoursMs / 3600000);
  const totalM = Math.round((totalHoursMs % 3600000) / 60000);
  const hasLeaves = leaves.length > 0;

  const exportCSV = useCallback(() => {
    const rows = [["Member", "Role", "Present", "Absent", "Late", "Overtime Days", "Total Hours", "Overtime Hours", "IPs"]];
    report.forEach((u: any) => rows.push([u.name, u.role ?? "staff", u.present, u.absent, u.late, u.otDays, u.totalHours, u.otHours, u.ips.join("; ")]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href={`/attendance/reports?month=${prev}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-lg font-semibold">{month}</span>
          <Link href={`/attendance/reports?month=${next}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Present</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallPresent}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Absent{hasLeaves ? "*" : ""}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalDays * users.length - overallPresent}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Late</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallLate}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">OT Days</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent">{overallOT}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Hours</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalH}h {totalM}m</p></CardContent></Card>
      </div>
      {hasLeaves && <p className="text-xs text-muted-foreground">* Absent excludes approved leave days</p>}

      <Card>
        <CardHeader><CardTitle>Member Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Member</th>
                <th className="pb-2 pr-3 font-medium">Role</th>
                <th className="pb-2 pr-3 font-medium text-right">Present</th>
                <th className="pb-2 pr-3 font-medium text-right">Absent</th>
                <th className="pb-2 pr-3 font-medium text-right">Late</th>
                <th className="pb-2 pr-3 font-medium text-right">OT Days</th>
                <th className="pb-2 pr-3 font-medium text-right">Hours</th>
                <th className="pb-2 font-medium text-right">OT Hours</th>
              </tr>
            </thead>
            <tbody>
              {report.map((u: any) => (
                <tr key={u._id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{u.name}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{u.role ?? "staff"}</td>
                  <td className="py-2 pr-3 text-right">{u.present}</td>
                  <td className={`py-2 pr-3 text-right ${u.absent > 0 ? "text-destructive" : ""}`}>{u.absent}</td>
                  <td className={`py-2 pr-3 text-right ${u.late > 0 ? "text-accent" : ""}`}>{u.late}</td>
                  <td className="py-2 pr-3 text-right text-accent">{u.otDays > 0 ? u.otDays : "—"}</td>
                  <td className="py-2 pr-3 text-right">{u.totalHours}</td>
                  <td className="py-2 text-right text-muted-foreground">{u.otHours}</td>
                </tr>
              ))}
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
