"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Notification } from "@/models/Notification";

export async function markNotificationRead(formData: FormData) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const id = String(formData.get("id") ?? "");
  await Notification.findOneAndUpdate({ _id: id, organizationId, userId: session.user.userId }, { readAt: new Date() });
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  await Notification.updateMany({ organizationId, userId: session.user.userId, readAt: null }, { readAt: new Date() });
  revalidatePath("/dashboard");
}
