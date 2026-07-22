import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { startTimer } from "@/lib/performance";
import type { Role } from "@/constants";

const rank: Record<Role, number> = {
  staff: 1,
  admin: 2,
  owner: 3,
  super_admin: 4
};

const getSession = cache(async () => {
  const timer = startTimer("auth.session");
  const session = await auth();
  timer.end();
  return session;
});

export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.userId || !session.user.active) redirect("/login");
  return session;
}

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export function hasRole(role: Role | undefined, allowed: readonly Role[]) {
  return !!role && allowed.includes(role);
}

export function atLeast(role: Role | undefined, minimum: Role) {
  if (!role) return false;
  return rank[role] >= rank[minimum];
}

export async function requireTenant() {
  const session = await requireSession();
  if (!session.user.organizationId) redirect("/organizations");
  return { session, organizationId: session.user.organizationId };
}
