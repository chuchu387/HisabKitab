"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { ApInvoice } from "@/models/ApInvoice";
import { Project } from "@/models/Project";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { purchaseOrderSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import type { ActionState } from "@/types";

export async function createPurchaseOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(purchaseOrderSchema, formData);
    await validateProject(organizationId, data.projectId);
    const totals = calculateTotals({ ...data, taxable: Boolean(data.taxable) });
    const order = await PurchaseOrder.create({
      organizationId,
      vendorName: data.vendorName,
      vendorPan: data.vendorPan,
      projectId: data.projectId || null,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      expectedBillDate: data.expectedBillDate,
      status: data.status,
      taxable: Boolean(data.taxable),
      lines: [{ description: data.description, quantity: data.quantity, rate: data.rate, amount: totals.subtotal }],
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: data.notes,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Purchase Order Created", entityType: "PurchaseOrder", entityId: order._id.toString(), metadata: { orderNumber: data.orderNumber, vendorName: data.vendorName, total: totals.total } });
    revalidatePath("/purchase-orders");
    return { ok: true, message: "Purchase order created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function convertPurchaseOrderToApInvoice(formData: FormData) {
  const { session, organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const order = await PurchaseOrder.findOne({ _id: id, organizationId }).lean() as any;
  if (!order) throw new Error("Purchase order not found");
  if (order.convertedApInvoiceId) throw new Error("Purchase order is already converted");
  const invoiceDate = new Date();
  const dueDate = order.expectedBillDate ? new Date(order.expectedBillDate) : invoiceDate;
  await assertFiscalYearOpen(organizationId, invoiceDate);
  await assertFiscalYearOpen(organizationId, dueDate);
  const invoice = await ApInvoice.create({
    organizationId,
    purchaseOrderId: order._id,
    projectId: order.projectId || null,
    vendorName: order.vendorName,
    vendorPan: order.vendorPan,
    billNumber: `BILL-${order.orderNumber}`,
    invoiceDate,
    dueDate,
    status: "posted",
    taxable: order.taxable,
    lines: order.lines,
    subtotal: order.subtotal,
    vatRate: order.vatRate,
    vatAmount: order.vatAmount,
    total: order.total,
    paidAmount: 0,
    notes: order.notes,
    createdBy: session.user.userId
  });
  await PurchaseOrder.updateOne({ _id: id, organizationId }, { status: "converted", convertedApInvoiceId: invoice._id });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Purchase Order Converted To AP Invoice", entityType: "PurchaseOrder", entityId: id, metadata: { apInvoiceId: invoice._id.toString(), billNumber: invoice.billNumber } });
  revalidatePath("/purchase-orders");
  revalidatePath("/ap-invoices");
}

export async function deletePurchaseOrder(formData: FormData) {
  const { session, organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const order = await PurchaseOrder.findOne({ _id: id, organizationId }).lean() as any;
  if (!order || order.convertedApInvoiceId) return;
  await PurchaseOrder.deleteOne({ _id: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Purchase Order Deleted", entityType: "PurchaseOrder", entityId: id, metadata: { orderNumber: order.orderNumber, vendorName: order.vendorName, total: order.total } });
  revalidatePath("/purchase-orders");
}

async function validateProject(organizationId: string, projectId?: string | null) {
  if (!projectId) return;
  const project = await Project.exists({ _id: projectId, organizationId });
  if (!project) throw new Error("Project not found");
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
