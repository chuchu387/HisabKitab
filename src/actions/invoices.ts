"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { invoiceSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
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
    const quantity = Number(data.quantity);
    const vatRate = Number(data.vatRate);
    const paidAmount = Number(data.paidAmount);
    const amount = round(quantity * data.rate);
    const vatAmount = round(amount * (vatRate / 100));
    const total = round(amount + vatAmount);
    await Invoice.create({
      organizationId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      status: data.status,
      lines: [{ description: data.description, quantity, rate: data.rate, amount }],
      subtotal: amount,
      vatRate,
      vatAmount,
      total,
      paidAmount: Math.min(paidAmount, total),
      notes: data.notes,
      createdBy: session.user.userId
    });
    revalidatePath("/invoices");
    return { ok: true, message: "Invoice created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteInvoice(formData: FormData) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  await Invoice.findOneAndDelete({ _id: String(formData.get("id")), organizationId });
  revalidatePath("/invoices");
}

function round(value: number) {
  return Number(value.toFixed(2));
}
