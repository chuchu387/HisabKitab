"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { actionError, parseForm } from "@/actions/helpers";
import { projectPaymentSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import { appUrl } from "@/services/email";
import { notifyProjectPayment } from "@/services/notifications";
import { nextVoucherNumber } from "@/services/vouchers";
import { User } from "@/models/User";
import type { ActionState } from "@/types";

export async function createProjectPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(projectPaymentSchema, formData);
    await assertFiscalYearOpen(organizationId, data.paymentDate);
    const project = (await Project.findOne({ _id: data.projectId, organizationId }).select("name code clientId receivedAmount").lean()) as any;
    if (!project) throw new Error("Project not found");
    const existingPaymentAgg = await ProjectPayment.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(data.projectId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, projectId: data.projectId, entityType: "ProjectPayment" }) : null;
    const voucherNumber = await nextVoucherNumber(ProjectPayment, organizationId, "projectPayment", data.paymentDate);
    let invoiceId = data.invoiceId || null;
    if (invoiceId) {
      const invoice = await Invoice.exists({ _id: data.invoiceId, organizationId, projectId: data.projectId });
      if (!invoice) throw new Error("Invoice not found for this project");
    } else if (data.autoCreateInvoice) {
      if (!project.clientId) throw new Error("This project has no client. Select an invoice manually or attach a client to the project first.");
      const existingInvoice = (await Invoice.findOne({
        organizationId,
        projectId: data.projectId,
        status: { $in: ["sent", "partial"] },
        $expr: { $lt: [{ $ifNull: ["$paidAmount", 0] }, { $ifNull: ["$total", 0] }] }
      }).sort({ invoiceDate: 1 }).select("_id").lean()) as any;
      if (existingInvoice) {
        invoiceId = existingInvoice._id.toString();
      } else {
        const organization = (await Organization.findById(organizationId).select("vatRegistered defaultVatRate").lean()) as any;
        const vatApplicable = Boolean(organization?.vatRegistered);
        const vatRate = vatApplicable ? Number(organization?.defaultVatRate ?? 13) : 0;
        const subtotal = data.amount;
        const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
        const invoice = await Invoice.create({
          organizationId,
          clientId: project.clientId,
          projectId: data.projectId,
          invoiceNumber: `INV-${voucherNumber}`,
          invoiceDate: data.paymentDate,
          dueDate: data.paymentDate,
          status: "paid",
          vatApplicable,
          lines: [{ description: data.note || `Payment received for ${project.name}`, quantity: 1, rate: subtotal, amount: subtotal }],
          subtotal,
          vatRate,
          vatAmount,
          total: Number((subtotal + vatAmount).toFixed(2)),
          paidAmount: data.amount,
          notes: `Auto-created from payment ${voucherNumber}`,
          createdBy: session.user.userId
        });
        invoiceId = invoice._id.toString();
      }
    }
    const payment = await ProjectPayment.create({ ...data, voucherNumber, invoiceId, bankAccountId: data.bankAccountId || null, organizationId, receiptImageId, createdBy: session.user.userId });
    const existingReceived = project.receivedAmount ?? 0;
    const nextReceived = existingReceived > 0 ? existingReceived + data.amount : (existingPaymentAgg[0]?.total ?? 0) + data.amount;
    await Project.updateOne({ _id: data.projectId, organizationId }, { $set: { receivedAmount: nextReceived } });
    if (invoiceId) await refreshInvoicePaymentStatus(invoiceId, organizationId);
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Created", entityType: "ProjectPayment", entityId: payment._id.toString(), metadata: { projectId: data.projectId, amount: data.amount, voucherNumber, invoiceId, autoCreatedInvoice: !data.invoiceId && Boolean(invoiceId) } });
    const recipients = await User.find({ organizationId, active: true, role: { $in: ["owner", "admin"] } }).select("name email").lean();
    await notifyProjectPayment((recipients as any[]).map((recipient) => ({ ...recipient, organizationId })), { projectName: project.name, amount: data.amount, paymentUrl: appUrl("/project-payments") }).catch(() => undefined);
    revalidatePath("/project-payments");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/reports");
    revalidatePath("/invoices");
    revalidatePath(`/projects/${data.projectId}`);
    return { ok: true, message: "Payment added" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteProjectPayment(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const payment = (await ProjectPayment.findOne({ _id: id, organizationId }).lean()) as any;
  if (!payment) throw new Error("Payment not found");
  await assertFiscalYearOpen(organizationId, payment.paymentDate);
  await ProjectPayment.deleteOne({ _id: id, organizationId });
  if (payment.projectId) {
    await Project.updateOne({ _id: payment.projectId, organizationId }, [{ $set: { receivedAmount: { $max: [0, { $subtract: [{ $ifNull: ["$receivedAmount", 0] }, payment.amount] }] } } }]);
  }
  if (payment.invoiceId) await refreshInvoicePaymentStatus(payment.invoiceId.toString(), organizationId);
  if (payment.receiptImageId) await deleteReceipt(payment.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Deleted", entityType: "ProjectPayment", entityId: id, metadata: { projectId: payment.projectId?.toString(), amount: payment.amount } });
  revalidatePath("/project-payments");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/reports");
  revalidatePath("/invoices");
  if (payment.projectId) revalidatePath(`/projects/${payment.projectId}`);
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
