"use client";

import { useState } from "react";
import { Camera, CalendarOff, CircleCheck, CircleMinus, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNepalTime } from "@/lib/timezone";

export function AttendanceTeam({ members, teamToday, leavesToday = [], halfDayAfterMinutes = 240 }: { members: { _id: string; name: string; role?: string }[]; teamToday: any[]; leavesToday?: any[]; halfDayAfterMinutes?: number }) {
  const recordMap = new Map(teamToday.map((a: any) => [a.userId?._id?.toString(), a]));
  const leaveMap = new Map(leavesToday.map((l: any) => [l.userId?._id?.toString() ?? l.userId?.toString(), true]));
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Today</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const record = recordMap.get(member._id);
            const checkedIn = !!record;
            const checkedOut = checkedIn && !!record.checkOutTime;
            const onLeave = !!leaveMap.get(member._id);
            const halfDay = checkedOut && halfDayAfterMinutes > 0 && new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime() < halfDayAfterMinutes * 60000;
            return (
              <div key={member._id} className={`flex items-center gap-3 rounded-lg border p-3 ${checkedIn ? "border-primary/30 bg-primary/5" : onLeave ? "border-purple-500/30 bg-purple-500/5" : "bg-card"}`}>
                {checkedIn ? (
                  checkedOut ? <LogOut className="h-5 w-5 shrink-0 text-muted-foreground" /> : <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
                ) : onLeave ? (
                  <CalendarOff className="h-5 w-5 shrink-0 text-purple-500" />
                ) : (
                  <CircleMinus className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    <span className={`ml-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-tight ${member.role === "owner" ? "bg-amber-100 text-amber-800" : member.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}>
                      {member.role ?? "staff"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {onLeave && !checkedIn
                      ? "On leave"
                      : checkedIn
                        ? `${formatNepalTime(record.checkInTime)} ${checkedOut ? `- ${formatNepalTime(record.checkOutTime)}` : "(active)"}`
                        : "Not checked in"}
                  </p>
                  {(onLeave && !checkedIn) && <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-tight bg-purple-100 text-purple-700">Leave</span>}
                  {halfDay && <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-tight bg-amber-100 text-amber-700">Half day</span>}
                </div>
                {record?.selfieId && (
                  <button type="button" onClick={() => setViewing(record.selfieId)} className="shrink-0 text-muted-foreground hover:text-foreground" title="View selfie">
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      {viewing && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/45 p-3 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="max-w-md overflow-hidden rounded-lg border bg-card shadow-2xl">
            <img src={`/api/attendance/${viewing}`} alt="Attendance selfie" className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </Card>
  );
}
