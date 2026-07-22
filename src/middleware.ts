import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("__Secure-authjs.session-token") ?? request.cookies.get("authjs.session-token") ?? request.cookies.get("__Secure-next-auth.session-token") ?? request.cookies.get("next-auth.session-token");
  const isLogin = request.nextUrl.pathname === "/login";
  if (!sessionCookie && !isLogin) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (sessionCookie && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login|forgot-password|reset-password).*)"]
};
