"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Product } from "@/models/Product";

export async function saveProduct(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const id = formData.get("id") as string;
    const data: any = { name: formData.get("name"), unitPrice: parseFloat(formData.get("unitPrice") as string), organizationId, createdBy: session.user.userId };
    if (formData.get("description")) data.description = formData.get("description");
    if (formData.get("unit")) data.unit = formData.get("unit");
    if (formData.get("category")) data.category = formData.get("category");
    if (id) {
      await Product.findOneAndUpdate({ _id: id, organizationId }, data);
    } else {
      await Product.create(data);
    }
    revalidatePath("/sales/products");
    return { ok: true, message: id ? "Product updated" : "Product created" };
  } catch (error: any) {
    return { ok: false, message: error.code === 11000 ? "Product name already exists" : "Failed to save product" };
  }
}

export async function deleteProduct(id: string): Promise<{ ok: boolean }> {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  await Product.findOneAndDelete({ _id: id, organizationId });
  revalidatePath("/sales/products");
  return { ok: true };
}

export async function getProducts(organizationId: string) {
  await connectToDatabase();
  return JSON.parse(JSON.stringify(await Product.find({ organizationId, active: true }).sort({ name: 1 }).lean()));
}
