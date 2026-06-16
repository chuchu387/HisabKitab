import { NextRequest, NextResponse } from "next/server";
import { mongo } from "mongoose";
import { requireTenant } from "@/lib/permissions";
import { getReceiptBucket } from "@/services/gridfs";

export async function GET(_: NextRequest, { params }: any) {
  const { organizationId } = await requireTenant();
  const bucket = await getReceiptBucket();
  const id = new mongo.ObjectId(params.id);
  const files = await bucket.find({ _id: id, "metadata.organizationId": organizationId }).toArray();
  if (!files[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stream = bucket.openDownloadStream(id);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": files[0].contentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${files[0].filename}"`
    }
  });
}

export async function DELETE(_: NextRequest, { params }: any) {
  const { organizationId } = await requireTenant();
  const bucket = await getReceiptBucket();
  const id = new mongo.ObjectId(params.id);
  const files = await bucket.find({ _id: id, "metadata.organizationId": organizationId }).toArray();
  if (!files[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await bucket.delete(id);
  return NextResponse.json({ ok: true });
}
