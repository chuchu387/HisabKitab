import { existsSync, readFileSync } from "fs";
import { connectToDatabase } from "@/lib/db";
import { FiscalYear } from "@/models/FiscalYear";
import { Organization } from "@/models/Organization";
import { nepalFiscalYearForDate, previousNepalFiscalYear } from "@/services/nepal-fiscal-year";

loadLocalEnv();

async function main() {
  await connectToDatabase();
  const current = nepalFiscalYearForDate();
  const previous = previousNepalFiscalYear();
  const organizations = await Organization.find({ status: { $ne: "inactive" } }).select("_id name").lean();
  for (const organization of organizations as any[]) {
    await FiscalYear.updateMany(
      { organizationId: organization._id, endDate: { $lt: current.startDate }, status: { $ne: "closed" } },
      { status: "closed", closedAt: new Date() }
    );
    await FiscalYear.updateOne(
      { organizationId: organization._id, name: previous.label },
      {
        $set: { startDate: previous.startDate, endDate: previous.endDate, status: "closed", closedAt: new Date() },
        $setOnInsert: { organizationId: organization._id }
      },
      { upsert: true }
    );
    await FiscalYear.updateOne(
      { organizationId: organization._id, name: current.label },
      {
        $set: { startDate: current.startDate, endDate: current.endDate, status: "open", closedBy: null, closedAt: null },
        $setOnInsert: { organizationId: organization._id }
      },
      { upsert: true }
    );
    console.log(`${organization.name}: opened ${current.label}, closed previous fiscal years`);
  }
  console.log(`Done. Current Nepal FY: ${current.label} (${current.from} to ${current.to})`);
}

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
