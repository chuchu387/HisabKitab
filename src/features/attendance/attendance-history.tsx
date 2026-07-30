"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Camera, CheckCircle, XCircle } from "lucide-react";

export function AttendanceHistory({ records }: { records: any[] }) {
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {records.map((record: any) => (
        <div key={record._id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <div className="shrink-0">
            {record.selfieId ? (
              <button type="button" onClick={() => setViewing(viewing === record.selfieId ? null : record.selfieId)}>
                <Camera className="h-5 w-5 text-primary" />
              </button>
            ) : (
              <CheckCircle className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{format(new Date(record.date + "T00:00:00"), "PPP")}</p>
            <p className="text-xs text-muted-foreground">
              {record.checkOutTime
                ? `${format(new Date(record.checkInTime), "hh:mm a")} - ${format(new Date(record.checkOutTime), "hh:mm a")}`
                : `Checked in at ${format(new Date(record.checkInTime), "hh:mm a")}`}
            </p>
          </div>
          {record.note && <p className="text-xs text-muted-foreground">{record.note}</p>}
        </div>
      ))}
      {!records.length && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <XCircle className="h-8 w-8" />
          <p className="text-sm">No attendance records found</p>
        </div>
      )}
      {viewing && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/45 p-3 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="max-w-md overflow-hidden rounded-lg border bg-card shadow-2xl">
            <img src={`/api/attendance/${viewing}`} alt="Attendance selfie" className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
