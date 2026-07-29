import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, isObjectId, money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";

void Client;
void Project;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const [invoice, organization] = await Promise.all([
    Invoice.findOne({ _id: id, organizationId }).populate("clientId projectId").lean() as any,
    Organization.findById(organizationId).lean() as any
  ]);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("INVOICE", { x: 40, y: 790, font: bold, size: 22, color: rgb(0.06, 0.46, 0.43) });
  page.drawText(organization?.name ?? "HisabKitab", { x: 40, y: 760, font: bold, size: 12 });
  page.drawText(`Invoice: ${invoice.invoiceNumber}`, { x: 380, y: 760, font, size: 10 });
  page.drawText(`Date: ${dateInput(invoice.invoiceDate) || "-"}`, { x: 380, y: 744, font, size: 10 });
  page.drawText(`Due: ${dateInput(invoice.dueDate) || "-"}`, { x: 380, y: 728, font, size: 10 });
  page.drawText(`Bill To: ${invoice.clientId?.name ?? "-"}`, { x: 40, y: 705, font: bold, size: 11 });
  page.drawText(`Project: ${invoice.projectId?.name ?? "-"}`, { x: 40, y: 688, font, size: 10 });
  page.drawText("Description", { x: 40, y: 640, font: bold, size: 10 });
  page.drawText("Qty", { x: 340, y: 640, font: bold, size: 10 });
  page.drawText("Rate", { x: 400, y: 640, font: bold, size: 10 });
  page.drawText("Amount", { x: 480, y: 640, font: bold, size: 10 });
  invoice.lines.forEach((line: any, index: number) => {
    const y = 615 - index * 18;
    page.drawText(String(line.description).slice(0, 50), { x: 40, y, font, size: 9 });
    page.drawText(String(line.quantity), { x: 340, y, font, size: 9 });
    page.drawText(money(line.rate), { x: 400, y, font, size: 9 });
    page.drawText(money(line.amount), { x: 480, y, font, size: 9 });
  });
  page.drawText(`Subtotal: ${money(invoice.subtotal)}`, { x: 390, y: 500, font, size: 10 });
  page.drawText(`VAT: ${money(invoice.vatAmount)}`, { x: 390, y: 482, font, size: 10 });
  page.drawText(`Total: ${money(invoice.total)}`, { x: 390, y: 462, font: bold, size: 12 });
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${invoice.invoiceNumber}.pdf` } });
}
