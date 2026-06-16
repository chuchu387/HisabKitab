import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectToDatabase } from "@/lib/db";
import { loginSchema } from "@/validations/schemas";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        await connectToDatabase();
        const email = parsed.data.email.toLowerCase().trim();
        const user = (await User.findOne({ email, active: true }).select("+password").lean()) as any;
        if (!user) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;
        if (user.role !== "super_admin") {
          const organization = await Organization.findOne({ _id: user.organizationId, status: "active" }).lean();
          if (!organization) return null;
        }
        return {
          id: user._id.toString(),
          userId: user._id.toString(),
          organizationId: user.organizationId?.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = String(user.userId);
        token.organizationId = user.organizationId ? String(user.organizationId) : undefined;
        token.role = user.role;
        token.active = Boolean(user.active);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = String(token.userId);
      session.user.organizationId = token.organizationId ? String(token.organizationId) : undefined;
      session.user.role = token.role as any;
      session.user.active = Boolean(token.active);
      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
