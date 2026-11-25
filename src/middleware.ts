import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("__Secure-authjs.session-token") ?? request.cookies.get("authjs.session-token") ?? request.cookies.get("__Secure-next-auth.session-token") ?? request.cookies.get("next-auth.session-token");
  const isLogin = request.nextUrl.pathname === "/login";
  const publicOrigin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? request.url;
  if (!sessionCookie && !isLogin) {
    const url = new URL("/login", publicOrigin);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (sessionCookie && isLogin) return NextResponse.redirect(new URL("/dashboard", publicOrigin));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/password|api/reminders|api/attendance/device|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|pwa|login|forgot-password|reset-password).*)"]
};
