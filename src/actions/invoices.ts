"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { invoiceSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(invoiceSchema, formData);
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
  const invoice = await Invoice.findOneAndDelete({ _id: id, organizationId }).lean() as any;
  if (invoice) await writeAuditLog({ organizationId, userId: session.user.userId, action: "Invoice Deleted", entityType: "Invoice", entityId: id, metadata: invoiceAuditSnapshot(invoice) });
  revalidatePath("/invoices");
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
