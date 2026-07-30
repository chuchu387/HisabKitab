"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProduct, deleteProduct } from "@/actions/products";

export function ProductList({ products }: { products: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const res = await saveProduct(fd);
    if (!res.ok) { toast.error(res.message); setSubmitting(false); return; }
    toast.success(res.message);
    setShowForm(false);
    setSubmitting(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await deleteProduct(id);
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Product deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!showForm && <Button onClick={() => setShowForm(true)} variant="outline" size="sm"><Plus className="h-4 w-4" /> Add Product</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Add Product</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price</Label>
                <Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" name="unit" placeholder="e.g. pcs, kg, hour" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Unit Price</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p._id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">Rs. {Number(p.unitPrice).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.unit || "-"}</td>
                  <td className="px-4 py-3">{p.category || "-"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleDelete(p._id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No products yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
