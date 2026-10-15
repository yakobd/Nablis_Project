import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/dashboard", "/settings", "/messaging", "/blogs", "/events",
  "/attendance", "/testimonials", "/appointment", "/bible-study",
  "/daily-prayers", "/gallery-app", "/members", "/notifications", "/search", "/announcements", "/challenges",
];
const LOGIN = "/login";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("__nablis_session")?.value;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isLogin = pathname === LOGIN;

  // "/" is the public marketing home page for everyone.
  if (isProtected && !session) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN;
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && session) {
    const from = request.nextUrl.searchParams.get("from") ?? "/dashboard";
    const url = request.nextUrl.clone();
    url.pathname = from;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/messaging/:path*",
    "/blogs/:path*",
    "/events/:path*",
    "/attendance/:path*",
    "/testimonials/:path*",
    "/appointment/:path*",
    "/bible-study/:path*",
    "/daily-prayers/:path*",
    "/gallery-app/:path*",
    "/members/:path*",
    "/notifications/:path*",
    "/search/:path*",
    "/announcements/:path*",
    "/challenges/:path*",
    "/login",
  ],
};
