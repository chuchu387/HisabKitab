import { mongo } from "mongoose";
import { connectToDatabase } from "@/lib/db";

export async function getReceiptBucket() {
  const conn = await connectToDatabase();
  const db = conn.connection.db;
  if (!db) throw new Error("MongoDB connection is not ready");
  return new mongo.GridFSBucket(db, { bucketName: "receipts" });
}

export async function saveReceipt(file: File, metadata: Record<string, unknown>) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Receipt image must be 5MB or smaller");
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image");
  const bucket = await getReceiptBucket();
  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = bucket.openUploadStream(file.name, { contentType: file.type, metadata });
  await new Promise<void>((resolve, reject) => {
    upload.end(buffer, (error?: Error) => (error ? reject(error) : resolve()));
  });
  return upload.id.toString();
}

export async function deleteReceipt(id: string) {
  const bucket = await getReceiptBucket();
  await bucket.delete(new mongo.ObjectId(id));
}
