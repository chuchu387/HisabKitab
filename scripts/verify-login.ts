import bcrypt from "bcryptjs";
import { loadEnvFile } from "node:process";
import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();
  const email = (process.argv[2] ?? "super@expense.test").toLowerCase().trim();
  const password = process.argv[3] ?? "Password123!";
  const user = (await User.findOne({ email }).select("+password").lean()) as any;

  if (!user) {
    console.log("LOGIN_CHECK_USER_NOT_FOUND");
    process.exit(1);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Active: ${user.active}`);
  console.log(`Organization ID: ${user.organizationId?.toString() ?? "none"}`);
  console.log(`Password matches: ${passwordMatches}`);
  process.exit(user.active && user.role === "super_admin" && passwordMatches ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
