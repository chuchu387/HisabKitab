"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { invoiceSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import { paymentAccountingStages } from "@/services/project-payment-accounting";
import { nextVoucherNumber } from "@/services/vouchers";
import type { ActionState } from "@/types";

export async function createInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(invoiceSchema, formData);
    await assertFiscalYearOpen(organizationId, data.invoiceDate);
    await assertFiscalYearOpen(organizationId, data.dueDate);
    const client = await Client.exists({ _id: data.clientId, organizationId });
    if (!client) throw new Error("Client not found");
    if (data.projectId) {
      const project = await Project.exists({ _id: data.projectId, organizationId });
      if (!project) throw new Error("Project not found");
    }
    const organization = (await Organization.findById(organizationId).select("vatRegistered defaultVatRate vatEffectiveDate").lean()) as any;
    const quantity = Number(data.quantity);
    const vatApplicable = isVatApplicable(Boolean(data.vatApplicable), organization, data.invoiceDate);
    const vatRate = vatApplicable ? Number(data.vatRate || organization?.defaultVatRate || 13) : 0;
    const paidAmount = Number(data.paidAmount);
    const amount = round(quantity * data.rate);
    const vatAmount = round(amount * (vatRate / 100));
    const total = round(amount + vatAmount);
    const invoice = await Invoice.create({
      organizationId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      status: data.status,
      vatApplicable,
      lines: [{ description: data.description, quantity, rate: data.rate, amount }],
      subtotal: amount,
      vatRate,
      vatAmount,
      total,
      paidAmount: Math.min(paidAmount, total),
      notes: data.notes,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Invoice Created", entityType: "Invoice", entityId: invoice._id.toString(), metadata: { invoiceNumber: data.invoiceNumber, subtotal: amount, vatAmount, total, vatApplicable } });
    revalidatePath("/invoices");
    return { ok: true, message: "Invoice created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateInvoice(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(invoiceSchema, formData);
    const invoice = await Invoice.findOne({ _id: id, organizationId });
    if (!invoice) throw new Error("Invoice not found");
    await assertFiscalYearOpen(organizationId, invoice.invoiceDate);
    await assertFiscalYearOpen(organizationId, data.invoiceDate);
    await assertFiscalYearOpen(organizationId, data.dueDate);
    const client = await Client.exists({ _id: data.clientId, organizationId });
    if (!client) throw new Error("Client not found");
    if (data.projectId) {
      const project = await Project.exists({ _id: data.projectId, organizationId });
      if (!project) throw new Error("Project not found");
    }
    const before = invoice.toObject();
    const organization = (await Organization.findById(organizationId).select("vatRegistered defaultVatRate vatEffectiveDate").lean()) as any;
    const quantity = Number(data.quantity);
    const vatApplicable = isVatApplicable(Boolean(data.vatApplicable), organization, data.invoiceDate);
    const vatRate = vatApplicable ? Number(data.vatRate || organization?.defaultVatRate || 13) : 0;
    const amount = round(quantity * data.rate);
    const vatAmount = round(amount * (vatRate / 100));
    const total = round(amount + vatAmount);
    const paidAmount = Math.min(Number(data.paidAmount), total);
    await Invoice.updateOne({ _id: id, organizationId }, {
      clientId: data.clientId,
      projectId: data.projectId || null,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      status: data.status,
      vatApplicable,
      lines: [{ description: data.description, quantity, rate: data.rate, amount }],
      subtotal: amount,
      vatRate,
      vatAmount,
      total,
      paidAmount,
      notes: data.notes
    }, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Invoice Updated", entityType: "Invoice", entityId: id, metadata: { before: invoiceAuditSnapshot(before), after: { invoiceNumber: data.invoiceNumber, subtotal: amount, vatAmount, total, paidAmount, vatApplicable } } });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}/edit`);
    return { ok: true, message: "Invoice updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteInvoice(formData: FormData) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const existing = await Invoice.findOne({ _id: id, organizationId }).lean() as any;
  if (!existing) return;
  await assertFiscalYearOpen(organizationId, existing.invoiceDate);
  const invoice = await Invoice.findOneAndDelete({ _id: id, organizationId }).lean() as any;
  if (invoice) await writeAuditLog({ organizationId, userId: session.user.userId, action: "Invoice Deleted", entityType: "Invoice", entityId: id, metadata: invoiceAuditSnapshot(invoice) });
  revalidatePath("/invoices");
}

export async function recordInvoicePayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const amount = Number(formData.get("amount") ?? 0);
    const paymentDate = new Date(String(formData.get("paymentDate") ?? ""));
    const bankAccountId = String(formData.get("bankAccountId") ?? "") || null;
    const note = String(formData.get("note") ?? "");
    if (!invoiceId || !Types.ObjectId.isValid(invoiceId)) throw new Error("Invoice is required");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");
    if (Number.isNaN(paymentDate.getTime())) throw new Error("Payment date is required");
    await assertFiscalYearOpen(organizationId, paymentDate);
    const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).lean() as any;
    if (!invoice) throw new Error("Invoice not found");
    if (!invoice.projectId) throw new Error("Invoice must be linked to a project before recording project payment");
    const existingAgg = await ProjectPayment.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), invoiceId: new Types.ObjectId(invoiceId) } },
      { $group: { _id: null, paid: { $sum: "$amount" } } }
    ]);
    const due = Math.max((invoice.total ?? 0) - (existingAgg[0]?.paid ?? 0), 0);
    if (amount > due) throw new Error(`Payment is higher than invoice due amount (${round(due)})`);
    const voucherNumber = await nextVoucherNumber(ProjectPayment, organizationId, "projectPayment", paymentDate);
    const payment = await ProjectPayment.create({
      organizationId,
      projectId: invoice.projectId,
      invoiceId,
      bankAccountId,
      paymentDate,
      amount,
      note: note || `Payment for invoice ${invoice.invoiceNumber}`,
      voucherNumber,
      createdBy: session.user.userId
    });
    await refreshInvoicePaymentStatus(invoiceId, organizationId);
    await refreshProjectReceived(invoice.projectId.toString(), organizationId);
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Invoice Payment Recorded", entityType: "ProjectPayment", entityId: payment._id.toString(), metadata: { invoiceId, amount, voucherNumber } });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/project-payments");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    revalidatePath("/reports");
    return { ok: true, message: "Invoice payment recorded" };
  } catch (error) {
    return actionError(error);
  }
}

function isVatApplicable(requested: boolean, organization: any, invoiceDate: Date) {
  const effectiveDate = organization?.vatEffectiveDate ? new Date(organization.vatEffectiveDate) : null;
  return Boolean(requested && organization?.vatRegistered && (!effectiveDate || invoiceDate >= effectiveDate));
}

function invoiceAuditSnapshot(invoice: any) {
  return {
    invoiceNumber: invoice.invoiceNumber,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
    vatApplicable: invoice.vatApplicable
  };
}

function round(value: number) {
  return Number(value.toFixed(2));
}

async function refreshInvoicePaymentStatus(invoiceId: string, organizationId: string) {
  const agg = await ProjectPayment.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), invoiceId: new Types.ObjectId(invoiceId) } },
    { $group: { _id: null, paid: { $sum: "$amount" } } }
  ]);
  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).select("total");
  if (!invoice) return;
  const paidAmount = Math.min(agg[0]?.paid ?? 0, invoice.total ?? 0);
  const status = paidAmount <= 0 ? "sent" : paidAmount >= (invoice.total ?? 0) ? "paid" : "partial";
  await Invoice.updateOne({ _id: invoiceId, organizationId }, { paidAmount, status });
}

async function refreshProjectReceived(projectId: string, organizationId: string) {
  const agg = await ProjectPayment.aggregate([
    { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(projectId) } },
    ...paymentAccountingStages(),
    { $group: { _id: null, total: { $sum: "$serviceAmountForAccounting" } } }
  ]);
  await Project.updateOne({ _id: projectId, organizationId }, { $set: { receivedAmount: round(agg[0]?.total ?? 0) } });
}
