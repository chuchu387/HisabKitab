import { PageShell } from "@/components/page-shell";
import { ProductList } from "@/features/crm/product-list";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getProducts } from "@/actions/products";

export default async function ProductsPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const products = await getProducts(organizationId);
  return (
    <PageShell title="Product Catalog">
      <ProductList products={products} />
    </PageShell>
  );
}
