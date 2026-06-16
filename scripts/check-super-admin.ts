import { loadEnvFile } from "node:process";
import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();
  const email = process.argv[2]?.toLowerCase().trim() ?? "super@expense.test";
  const user = (await User.findOne({ email }).lean()) as any;

  if (!user) {
    console.log(`No user found for ${email}`);
    process.exit(1);
  }

  console.log("Super Admin database record");
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Active: ${user.active}`);
  console.log(`Organization ID: ${user.organizationId?.toString() ?? "none"}`);
  process.exit(user.role === "super_admin" && user.active ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
