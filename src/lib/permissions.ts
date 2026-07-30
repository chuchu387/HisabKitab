import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { User } from "@/models/User";
import { resolvePermissions, type FeatureKey, type PermissionOverrides } from "@/constants/permissions";
import type { Role } from "@/constants";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export function corsResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.userId || !session?.user?.active) redirect("/login");
  return session as unknown as { user: { userId: string; organizationId?: string; name: string; email: string; role: Role; active: boolean } };
});

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requireTenant(): Promise<{ session: Awaited<ReturnType<typeof requireSession>>; organizationId: string }> {
  const session = await requireSession();
  if (!session.user.organizationId) redirect("/organizations");
  return { session, organizationId: session.user.organizationId };
}

export function hasRole(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export function atLeast(role: Role, minimum: Role) {
  const rank: Record<string, number> = { staff: 1, admin: 2, owner: 3, super_admin: 4 };
  return (rank[role] ?? 0) >= (rank[minimum] ?? 0);
}

export async function resolveUserPermissions(userId: string, role: string, overrides?: PermissionOverrides) {
  return resolvePermissions(role, overrides);
}

export async function requireFeature(feature: FeatureKey) {
  const { session, organizationId } = await requireTenant();
  const user = await User.findById(session.user.userId).select("role permissions").lean() as any;
  if (!user) redirect("/dashboard");
  if (user.role === "owner") return { session, organizationId };
  const perms = resolvePermissions(user.role, user.permissions || {});
  if (!perms[feature]) redirect("/dashboard");
  return { session, organizationId, permissions: perms };
}

export async function requireFeatureOrRole(feature: FeatureKey, allowed: Role[]) {
  const session = await requireSession();
  if (allowed.includes(session.user.role)) return session;
  const user = await User.findById(session.user.userId).select("role permissions").lean() as any;
  if (!user) redirect("/dashboard");
  if (user.role === "owner") return session;
  const perms = resolvePermissions(user.role, user.permissions || {});
  if (!perms[feature]) redirect("/dashboard");
  return session;
}
