"use client";

import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AttendanceCalendar({ records, currentMonth: _ }: { records: any[]; currentMonth: string }) {
  const [current, setCurrent] = useState(new Date());
  const markedDates = useMemo(() => new Set(records.map((r) => r.date)), [records]);

  function renderCells() {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const rows: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];
    let day = startDate;
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const d = day;
        const dateStr = format(d, "yyyy-MM-dd");
        const isCurrent = isSameMonth(d, current);
        const isMarked = markedDates.has(dateStr);
        const isToday = isSameDay(d, new Date());
        days.push(
          <td key={dateStr} className={`p-1 text-center text-sm ${isCurrent ? "" : "text-muted-foreground/40"} ${isToday ? "font-bold" : ""}`}>
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${isMarked ? "bg-primary text-primary-foreground" : ""}`}>
              {format(d, "d")}
            </div>
          </td>
        );
        day = addDays(day, 1);
      }
      rows.push(<tr key={day.toString()}>{days}</tr>);
      days = [];
    }
    return rows;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <Button variant="ghost" size="sm" onClick={() => setCurrent(subMonths(current, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{format(current, "MMMM yyyy")}</span>
        <Button variant="ghost" size="sm" onClick={() => setCurrent(addMonths(current, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <table className="w-full">
          <thead>
            <tr>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <th key={d} className="pb-2 text-center text-xs font-medium text-muted-foreground">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>{renderCells()}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}
