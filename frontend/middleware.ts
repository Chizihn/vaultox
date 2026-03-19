import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "vaultox_access_token";
const CREDENTIAL_STATUS_COOKIE = "vaultox_credential_status";

const protectedPrefixes = [
  "/dashboard",
  "/vaults",
  "/settlements",
  "/reports",
  "/compliance",
  "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const credentialStatus = request.cookies.get(CREDENTIAL_STATUS_COOKIE)?.value;

  const status =
    credentialStatus === "verified" ||
    credentialStatus === "pending_kyc" ||
    credentialStatus === "unregistered"
      ? credentialStatus
      : null;

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAccessPendingRoute =
    pathname === "/access-pending" || pathname.startsWith("/access-pending/");

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && token && status !== "verified") {
    // Exempt /admin and /access-pending from the verified check
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return NextResponse.next();
    }

    const pendingUrl = new URL("/access-pending", request.url);
    pendingUrl.searchParams.set("status", status ?? "unregistered");
    return NextResponse.redirect(pendingUrl);
  }

  if (isAccessPendingRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAccessPendingRoute && token && status === "verified") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/login" && token) {
    if (status && status !== "verified") {
      const pendingUrl = new URL("/access-pending", request.url);
      pendingUrl.searchParams.set("status", status);
      return NextResponse.redirect(pendingUrl);
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/vaults/:path*",
    "/settlements/:path*",
    "/reports/:path*",
    "/compliance/:path*",
    "/admin/:path*",
    "/access-pending/:path*",
  ],
};
