"use client";

import { useState } from "react";
import { Camera, XCircle } from "lucide-react";
import { formatNepalTime, formatNepalDate } from "@/lib/timezone";

export function SelfieGallery({ records }: { records: any[] }) {
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {records.map((record: any) => {
          const user = record.userId ?? {};
          const name = user.name ?? "Unknown";
          const role = user.role ?? "";
          return (
            <div key={record._id} className="group overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md">
              <button type="button" onClick={() => setViewing(record.selfieId)} className="block w-full">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={`/api/attendance/${record.selfieId}`}
                    alt={`Selfie of ${name}`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              </button>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-semibold">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {role && (
                    <span className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${role === "owner" ? "bg-amber-100 text-amber-800" : role === "admin" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"}`}>
                      {role}
                    </span>
                  )}
                  <span>{formatNepalDate(new Date(record.date + "T00:00:00"))}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNepalTime(record.checkInTime)}
                  {record.checkOutTime && ` - ${formatNepalTime(record.checkOutTime)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {!records.length && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Camera className="h-10 w-10" />
          <p className="text-sm">No selfies captured yet</p>
        </div>
      )}
      {viewing && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/45 p-3 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="relative max-w-2xl overflow-hidden rounded-lg border bg-card shadow-2xl">
            <button type="button" onClick={() => setViewing(null)} className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-foreground shadow-sm hover:bg-background">
              <XCircle className="h-5 w-5" />
            </button>
            <img src={`/api/attendance/${viewing}`} alt="Selfie" className="max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
