import { loadEnvFile } from "node:process";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import { Project } from "../src/models/Project";
import { ProjectPayment } from "../src/models/ProjectPayment";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();
  const projects = await Project.find({
    receivedAmount: { $gt: 0 },
    projectType: { $ne: "internal" }
  }).lean();

  let created = 0;
  let totalBackfilled = 0;

  for (const project of projects as any[]) {
    const [paymentAgg] = await ProjectPayment.aggregate([
      { $match: { organizationId: new Types.ObjectId(project.organizationId), projectId: new Types.ObjectId(project._id) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const existingTotal = paymentAgg?.total ?? 0;
    const missingAmount = Number((project.receivedAmount - existingTotal).toFixed(2));
    if (missingAmount <= 0) continue;

    await ProjectPayment.create({
      organizationId: project.organizationId,
      projectId: project._id,
      paymentDate: project.createdAt ?? new Date(),
      amount: missingAmount,
      note: "Backfilled from project received amount",
      receiptImageId: null,
      createdBy: project.createdBy
    });
    created += 1;
    totalBackfilled += missingAmount;
    console.log(`Backfilled ${project.name} (${project.code}): ${missingAmount}`);
  }

  console.log(`Created ${created} payment records`);
  console.log(`Backfilled total: ${totalBackfilled.toFixed(2)}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
