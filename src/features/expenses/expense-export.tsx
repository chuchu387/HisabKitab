"use client";

import { useState } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExpensesForExport, type ExpenseExportRow } from "@/actions/expenses";
import { money } from "@/lib/utils";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export function ExpenseExportButtons({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  async function run(format: "csv" | "pdf") {
    setBusy(format);
    try {
      const data = await getExpensesForExport(searchParams);
      if (!data.rows.length) return;
      if (format === "csv") downloadCsv(data.rows, data.total);
      else await downloadPdf(data.rows, data.total);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("csv")}>
        {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        CSV
      </Button>
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("pdf")}>
        {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        PDF
      </Button>
    </div>
  );
}

const HEADERS = ["Date", "Voucher", "FY", "Category", "Project", "Description", "Amount"];

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: ExpenseExportRow[], total: number) {
  const lines = [HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push([row.date, row.voucher, row.fy, row.category, row.project, row.description, row.amount.toFixed(2)].map(csvCell).join(","));
  }
  lines.push(["", "", "", "", "", "TOTAL", total.toFixed(2)].map(csvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const COLS = [
  { label: "Date", width: 60 },
  { label: "Voucher", width: 66 },
  { label: "FY", width: 72 },
  { label: "Category", width: 80 },
  { label: "Project", width: 70 },
  { label: "Description", width: 180 },
  { label: "Amount", width: 62 }
];

async function downloadPdf(rows: ExpenseExportRow[], total: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.42, 0.42, 0.42);
  const black = rgb(0.1, 0.1, 0.1);
  const lineColor = rgb(0.85, 0.85, 0.85);
  const totalWidth = COLS.reduce((sum, col) => sum + col.width, 0);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawHeader(p: typeof page) {
    let x = MARGIN;
    p.drawText("Expense Report", { x: MARGIN, y: y + 30, size: 17, font: bold, color: black });
    p.drawText(`Generated: ${new Date().toLocaleString()}`, { x: MARGIN, y: y + 16, size: 9, font, color: gray });
    for (const col of COLS) {
      p.drawText(col.label, { x: x + 2, y: y, size: 9, font: bold, color: black });
      x += col.width;
    }
    p.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: MARGIN + totalWidth, y: y - 4 }, thickness: 0.6, color: lineColor });
    y -= 14;
  }

  function fitLines(text: string, width: number, size: number) {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width - 4) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines.slice(0, 3) : [""];
  }

  drawHeader(page);

  for (const row of rows) {
    const descLines = fitLines(row.description, COLS[5].width, 8);
    const rowHeight = Math.max(16, descLines.length * 11 + 5);
    if (y < MARGIN + rowHeight) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawHeader(page);
    }
    let x = MARGIN;
    const cells = [row.date, row.voucher, row.fy, row.category, row.project, row.description, money(row.amount)];
    for (let i = 0; i < COLS.length; i++) {
      const col = COLS[i];
      if (i === 5) {
        let ty = y - 2;
        for (const line of descLines) {
          page.drawText(line, { x: x + 2, y: ty, size: 8, font, color: black });
          ty -= 11;
        }
      } else {
        page.drawText(String(cells[i]), { x: x + 2, y: y - 2, size: 8, font, color: black });
      }
      page.drawLine({ start: { x: x + col.width, y: y + 2 }, end: { x: x + col.width, y: y - rowHeight + 3 }, thickness: 0.3, color: lineColor });
      x += col.width;
    }
    page.drawLine({ start: { x: MARGIN, y: y - rowHeight + 2 }, end: { x: MARGIN + totalWidth, y: y - rowHeight + 2 }, thickness: 0.3, color: lineColor });
    y -= rowHeight;
  }

  if (y < MARGIN + 30) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }
  let x = MARGIN + totalWidth - COLS[COLS.length - 1].width;
  page.drawText("TOTAL", { x: x + 2, y: y - 2, size: 9, font: bold, color: black });
  page.drawText(money(total), { x: x + COLS[COLS.length - 1].width - 2 - font.widthOfTextAtSize(money(total), 9), y: y - 2, size: 9, font: bold, color: black });
  page.drawLine({ start: { x: MARGIN, y: y - 6 }, end: { x: MARGIN + totalWidth, y: y - 6 }, thickness: 0.8, color: black });

  const bytes = await doc.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}