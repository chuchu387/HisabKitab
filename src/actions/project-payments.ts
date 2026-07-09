"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { actionError, parseForm } from "@/actions/helpers";
import { projectPaymentSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createProjectPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(projectPaymentSchema, formData);
    const project = await Project.exists({ _id: data.projectId, organizationId });
    if (!project) throw new Error("Project not found");
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, projectId: data.projectId, entityType: "ProjectPayment" }) : null;
    const payment = await ProjectPayment.create({ ...data, organizationId, receiptImageId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Created", entityType: "ProjectPayment", entityId: payment._id.toString(), metadata: { projectId: data.projectId, amount: data.amount } });
    revalidatePath("/project-payments");
    revalidatePath("/dashboard");
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
  const payment = (await ProjectPayment.findOneAndDelete({ _id: id, organizationId }).lean()) as any;
  if (!payment) throw new Error("Payment not found");
  if (payment.receiptImageId) await deleteReceipt(payment.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Deleted", entityType: "ProjectPayment", entityId: id, metadata: { projectId: payment.projectId?.toString(), amount: payment.amount } });
  revalidatePath("/project-payments");
  revalidatePath("/dashboard");
  if (payment.projectId) revalidatePath(`/projects/${payment.projectId}`);
}
