import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD || "admin123";
  const session = req.cookies.get(ADMIN_COOKIE)?.value;

  if (session !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
