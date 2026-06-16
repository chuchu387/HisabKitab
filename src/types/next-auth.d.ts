import type { Role } from "@/constants";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      userId: string;
      organizationId?: string;
      role: Role;
      active: boolean;
    };
  }

  interface User {
    userId: string;
    organizationId?: string;
    role: Role;
    active: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId?: string;
    role: Role;
    active: boolean;
  }
}
