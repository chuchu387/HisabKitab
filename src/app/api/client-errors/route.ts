import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.userId) return Response.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json();
    console.error("[client-error]", {
      userId: session.user.userId,
      organizationId: session.user.organizationId,
      message: clean(body?.message, 1000),
      stack: clean(body?.stack, 8000),
      digest: clean(body?.digest, 200),
      path: clean(body?.path, 1000),
      userAgent: clean(body?.userAgent, 1000)
    });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  return Response.json({ ok: true });
}
