import bcrypt from "bcryptjs";
import { loadEnvFile } from "node:process";
import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";

loadEnvFile(".env.local");

async function main() {
  await connectToDatabase();

  const email = process.env.SUPER_ADMIN_EMAIL ?? "super@expense.test";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "Password123!";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: {
        name,
        email: email.toLowerCase(),
        password: await bcrypt.hash(password, 12),
        role: "super_admin",
        active: true,
        organizationId: undefined
      }
    },
    { upsert: true, runValidators: true }
  );

  console.log("Super Admin ready");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
