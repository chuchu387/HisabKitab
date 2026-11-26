import { PageShell } from "@/components/page-shell";
import { ProductList } from "@/features/crm/product-list";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { getProducts } from "@/actions/products";

export default async function ProductsPage() {
  await requireFeature("productsManage");
  await connectToDatabase();
  const products = await getProducts();
  return (
    <PageShell title="Product Catalog">
      <ProductList products={products} />
    </PageShell>
  );
}
