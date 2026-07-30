import { NextResponse } from "next/server";
import { mongo } from "mongoose";
import { getReceiptBucket } from "@/services/gridfs";
import { isObjectId } from "@/lib/utils";
import { requireTenant } from "@/lib/permissions";

export async function GET(_request: Request, { params }: any) {
  const { organizationId } = await requireTenant();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) return NextResponse.json({ error: "Invalid id" }, { status: 404 });
  const bucket = await getReceiptBucket();
  const id = new mongo.ObjectId(routeParams.id);
  const files = await bucket.find({ _id: id, "metadata.organizationId": organizationId }).toArray();
  if (!files.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = files[0];
  const stream: any = bucket.openDownloadStream(id);
  return new NextResponse(stream as ReadableStream, {
    headers: {
      "Content-Type": file.contentType ?? "image/jpeg",
      "Content-Disposition": `inline; filename="${file.filename}"`
    }
  });
}
