"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { SalesOrder } from "@/models/SalesOrder";
import { salesOrderSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import type { ActionState } from "@/types";

export async function createSalesOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(salesOrderSchema, formData);
    await validateReferences(organizationId, data.clientId, data.projectId);
    const totals = await calculateTotals(organizationId, { ...data, vatApplicable: Boolean(data.vatApplicable) });
    const order = await SalesOrder.create({
      organizationId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      expectedInvoiceDate: data.expectedInvoiceDate,
      status: data.status,
      vatApplicable: totals.vatApplicable,
      lines: [{ description: data.description, quantity: data.quantity, rate: data.rate, amount: totals.subtotal }],
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: data.notes,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Sales Order Created", entityType: "SalesOrder", entityId: order._id.toString(), metadata: { orderNumber: data.orderNumber, total: totals.total } });
    revalidatePath("/sales-orders");
    return { ok: true, message: "Sales order created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSalesOrder(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(salesOrderSchema, formData);
    const order = await SalesOrder.findOne({ _id: id, organizationId });
    if (!order) throw new Error("Sales order not found");
    if (order.convertedInvoiceId) throw new Error("Converted sales orders cannot be edited");
    await validateReferences(organizationId, data.clientId, data.projectId);
    const totals = await calculateTotals(organizationId, { ...data, vatApplicable: Boolean(data.vatApplicable) });
    await SalesOrder.updateOne({ _id: id, organizationId }, {
      clientId: data.clientId,
      projectId: data.projectId || null,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      expectedInvoiceDate: data.expectedInvoiceDate,
      status: data.status,
      vatApplicable: totals.vatApplicable,
      lines: [{ description: data.description, quantity: data.quantity, rate: data.rate, amount: totals.subtotal }],
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: data.notes
    }, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Sales Order Updated", entityType: "SalesOrder", entityId: id, metadata: { orderNumber: data.orderNumber, total: totals.total } });
    revalidatePath("/sales-orders");
    return { ok: true, message: "Sales order updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function convertSalesOrderToInvoice(formData: FormData) {
  const { session, organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const order = await SalesOrder.findOne({ _id: id, organizationId }).lean() as any;
  if (!order) throw new Error("Sales order not found");
  if (order.convertedInvoiceId) throw new Error("Sales order is already converted");
  const invoiceDate = new Date();
  const dueDate = order.expectedInvoiceDate ? new Date(order.expectedInvoiceDate) : invoiceDate;
  await assertFiscalYearOpen(organizationId, invoiceDate);
  await assertFiscalYearOpen(organizationId, dueDate);
  const invoice = await Invoice.create({
    organizationId,
    clientId: order.clientId,
    projectId: order.projectId || null,
    invoiceNumber: `INV-${order.orderNumber}`,
    invoiceDate,
    dueDate,
    status: "sent",
    vatApplicable: order.vatApplicable,
    lines: order.lines,
    subtotal: order.subtotal,
    vatRate: order.vatRate,
    vatAmount: order.vatAmount,
    total: order.total,
    paidAmount: 0,
    notes: order.notes,
    createdBy: session.user.userId,
    salesOrderId: order._id
  });
  await SalesOrder.updateOne({ _id: id, organizationId }, { status: "converted", convertedInvoiceId: invoice._id });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Sales Order Converted To Invoice", entityType: "SalesOrder", entityId: id, metadata: { invoiceId: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber } });
  revalidatePath("/sales-orders");
  revalidatePath("/invoices");
}

export async function deleteSalesOrder(formData: FormData) {
  const { session, organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const order = await SalesOrder.findOne({ _id: id, organizationId }).lean() as any;
  if (!order || order.convertedInvoiceId) return;
  await SalesOrder.deleteOne({ _id: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Sales Order Deleted", entityType: "SalesOrder", entityId: id, metadata: { orderNumber: order.orderNumber, total: order.total } });
  revalidatePath("/sales-orders");
}

async function validateReferences(organizationId: string, clientId: string, projectId?: string | null) {
  const client = await Client.exists({ _id: clientId, organizationId });
  if (!client) throw new Error("Client not found");
  if (projectId) {
    const project = await Project.exists({ _id: projectId, organizationId });
    if (!project) throw new Error("Project not found");
  }
}

async function calculateTotals(organizationId: string, data: { quantity: number; rate: number; vatApplicable: boolean; vatRate?: number; orderDate: Date }) {
  const organization = await Organization.findById(organizationId).select("vatRegistered defaultVatRate vatEffectiveDate").lean() as any;
  const effectiveDate = organization?.vatEffectiveDate ? new Date(organization.vatEffectiveDate) : null;
  const vatApplicable = Boolean(data.vatApplicable && organization?.vatRegistered && (!effectiveDate || data.orderDate >= effectiveDate));
  const vatRate = vatApplicable ? Number(data.vatRate || organization?.defaultVatRate || 13) : 0;
  const subtotal = round(Number(data.quantity) * Number(data.rate));
  const vatAmount = round(subtotal * (vatRate / 100));
  return { subtotal, vatApplicable, vatRate, vatAmount, total: round(subtotal + vatAmount) };
}

function round(value: number) {
  return Number(value.toFixed(2));
}
