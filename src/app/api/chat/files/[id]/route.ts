import { NextResponse } from "next/server";
import { mongo } from "mongoose";
import { getReceiptBucket } from "@/services/gridfs";
import { requireTenant } from "@/lib/permissions";

export async function GET(_: Request, { params }: any) {
  try {
    const { organizationId } = await requireTenant();
    const { id } = await params;
    const bucket = await getReceiptBucket();
    const files = await bucket.find({ _id: new mongo.ObjectId(id) }).toArray();
    if (!files.length) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const file = files[0];
    if (file.metadata?.organizationId?.toString() !== organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const download = bucket.openDownloadStream(new mongo.ObjectId(id));
    const chunks: Buffer[] = [];
    for await (const chunk of download) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
