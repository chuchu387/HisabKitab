"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { defaultCategories } from "@/constants";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { createOrganizationSchema, organizationSchema, organizationSettingsSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await requireRole(["super_admin"]);
    await connectToDatabase();
    const data = parseForm(createOrganizationSchema, formData);
    const existingUser = await User.exists({ email: data.email.toLowerCase() });
    if (existingUser) throw new Error("A user with this email already exists");
    const organization = await Organization.create({
      name: data.name,
      code: data.code.toUpperCase(),
      email: data.email,
      phone: data.phone,
      address: data.address,
      generalBudget: data.generalBudget,
      createdBy: session.user.userId,
      status: data.status,
      attendanceMode: data.attendanceMode,
      device: {
        deviceSn: data.deviceSn ?? "",
        pushSecret: data.pushSecret ?? "",
        deviceUrl: data.deviceUrl ?? "",
        pollEnabled: data.pollEnabled
      }
    });
    await User.create({
      organizationId: organization._id,
      name: data.adminName,
      email: data.email,
      password: await bcrypt.hash(data.adminPassword, 12),
      role: "owner",
      active: true
    });
    await ExpenseCategory.insertMany(defaultCategories.map((name) => ({ organizationId: organization._id, name, active: true })));
    revalidatePath("/organizations");
    return { ok: true, message: "Organization and owner login created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOrganization(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["super_admin"]);
    await connectToDatabase();
    const data = parseForm(organizationSchema, formData);
    const { deviceSn, pushSecret, deviceUrl, pollEnabled, ...orgFields } = data;
    await Organization.findByIdAndUpdate(
      id,
      { ...orgFields, code: data.code.toUpperCase(), device: { deviceSn, pushSecret, deviceUrl, pollEnabled } },
      { runValidators: true }
    );
    revalidatePath("/organizations");
    return { ok: true, message: "Organization updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateOrganization(formData: FormData) {
  await requireRole(["super_admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  await Organization.findByIdAndUpdate(id, { status: "inactive" });
  revalidatePath("/organizations");
}

export async function updateOrganizationSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await connectToDatabase();
    const data = parseForm(organizationSettingsSchema, formData);
    const before = await Organization.findById(organizationId).select("vatRegistered defaultVatRate vatEffectiveDate panNumber").lean() as any;
    await Organization.findOneAndUpdate({ _id: organizationId }, data, { runValidators: true });
    if (
      before?.vatRegistered !== data.vatRegistered ||
      Number(before?.defaultVatRate ?? 13) !== Number(data.defaultVatRate ?? 13) ||
      String(before?.vatEffectiveDate ? new Date(before.vatEffectiveDate).toISOString().slice(0, 10) : "") !== String(data.vatEffectiveDate ? new Date(data.vatEffectiveDate as Date).toISOString().slice(0, 10) : "") ||
      String(before?.panNumber ?? "") !== String(data.panNumber ?? "")
    ) {
      await writeAuditLog({ organizationId, userId: session.user.userId, action: "VAT Settings Updated", entityType: "Organization", entityId: organizationId, metadata: { before, after: { vatRegistered: data.vatRegistered, defaultVatRate: data.defaultVatRate, vatEffectiveDate: data.vatEffectiveDate, panNumber: data.panNumber } } });
    }
    revalidatePath("/settings");
    return { ok: true, message: "Settings updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function redirectToOrganizationForm() {
  redirect("/organizations/new");
}
