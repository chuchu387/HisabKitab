"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { actionError, parseForm } from "@/actions/helpers";
import { projectPaymentSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { appUrl } from "@/services/email";
import { notifyProjectPayment } from "@/services/notifications";
import { User } from "@/models/User";
import type { ActionState } from "@/types";

export async function createProjectPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(projectPaymentSchema, formData);
    const project = (await Project.findOne({ _id: data.projectId, organizationId }).select("name receivedAmount").lean()) as any;
    if (!project) throw new Error("Project not found");
    const existingPaymentAgg = await ProjectPayment.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), projectId: new Types.ObjectId(data.projectId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, projectId: data.projectId, entityType: "ProjectPayment" }) : null;
    const payment = await ProjectPayment.create({ ...data, organizationId, receiptImageId, createdBy: session.user.userId });
    const existingReceived = project.receivedAmount ?? 0;
    const nextReceived = existingReceived > 0 ? existingReceived + data.amount : (existingPaymentAgg[0]?.total ?? 0) + data.amount;
    await Project.updateOne({ _id: data.projectId, organizationId }, { $set: { receivedAmount: nextReceived } });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Created", entityType: "ProjectPayment", entityId: payment._id.toString(), metadata: { projectId: data.projectId, amount: data.amount } });
    const recipients = await User.find({ organizationId, active: true, role: { $in: ["owner", "admin"] } }).select("name email").lean();
    await notifyProjectPayment((recipients as any[]).map((recipient) => ({ ...recipient, organizationId })), { projectName: project.name, amount: data.amount, paymentUrl: appUrl("/project-payments") }).catch(() => undefined);
    revalidatePath("/project-payments");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/reports");
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
  if (payment.projectId) {
    await Project.updateOne({ _id: payment.projectId, organizationId }, [{ $set: { receivedAmount: { $max: [0, { $subtract: [{ $ifNull: ["$receivedAmount", 0] }, payment.amount] }] } } }]);
  }
  if (payment.receiptImageId) await deleteReceipt(payment.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Payment Deleted", entityType: "ProjectPayment", entityId: id, metadata: { projectId: payment.projectId?.toString(), amount: payment.amount } });
  revalidatePath("/project-payments");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/reports");
  if (payment.projectId) revalidatePath(`/projects/${payment.projectId}`);
}
