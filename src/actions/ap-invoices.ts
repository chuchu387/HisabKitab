"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { ApInvoice } from "@/models/ApInvoice";
import { Project } from "@/models/Project";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { apInvoiceSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import type { ActionState } from "@/types";

export async function createApInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(apInvoiceSchema, formData);
    await assertFiscalYearOpen(organizationId, data.invoiceDate);
    await assertFiscalYearOpen(organizationId, data.dueDate);
    await validateReferences(organizationId, data.projectId, data.purchaseOrderId);
    const totals = calculateTotals({ ...data, taxable: Boolean(data.taxable) });
    const paidAmount = Math.min(Number(data.paidAmount), totals.total);
    const invoice = await ApInvoice.create({
      organizationId,
      purchaseOrderId: data.purchaseOrderId || null,
      projectId: data.projectId || null,
      vendorName: data.vendorName,
      vendorPan: data.vendorPan,
      billNumber: data.billNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      status: paidAmount >= totals.total ? "paid" : paidAmount > 0 ? "partial" : data.status,
      taxable: Boolean(data.taxable),
      lines: [{ description: data.description, quantity: data.quantity, rate: data.rate, amount: totals.subtotal }],
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      paidAmount,
      notes: data.notes,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "AP Invoice Created", entityType: "ApInvoice", entityId: invoice._id.toString(), metadata: { billNumber: data.billNumber, vendorName: data.vendorName, total: totals.total, paidAmount } });
    revalidatePath("/ap-invoices");
    return { ok: true, message: "AP invoice created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteApInvoice(formData: FormData) {
  const { session, organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const invoice = await ApInvoice.findOne({ _id: id, organizationId }).lean() as any;
  if (!invoice) return;
  await assertFiscalYearOpen(organizationId, invoice.invoiceDate);
  await ApInvoice.deleteOne({ _id: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "AP Invoice Deleted", entityType: "ApInvoice", entityId: id, metadata: { billNumber: invoice.billNumber, vendorName: invoice.vendorName, total: invoice.total } });
  revalidatePath("/ap-invoices");
}

async function validateReferences(organizationId: string, projectId?: string | null, purchaseOrderId?: string | null) {
  if (projectId) {
    const project = await Project.exists({ _id: projectId, organizationId });
    if (!project) throw new Error("Project not found");
  }
  if (purchaseOrderId) {
    const order = await PurchaseOrder.exists({ _id: purchaseOrderId, organizationId });
    if (!order) throw new Error("Purchase order not found");
  }
}

function calculateTotals(data: { quantity: number; rate: number; taxable: boolean; vatRate?: number }) {
  const subtotal = round(Number(data.quantity) * Number(data.rate));
  const vatRate = data.taxable ? Number(data.vatRate || 13) : 0;
  const vatAmount = round(subtotal * (vatRate / 100));
  return { subtotal, vatRate, vatAmount, total: round(subtotal + vatAmount) };
}

function round(value: number) {
  return Number(value.toFixed(2));
}
