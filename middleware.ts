import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";
import { getSessionTokenFromCookieHeader } from "@/infrastructure/auth/request-auth";

export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const authService = createAuthService();
    const user = await authService.me(sessionToken);

    if (user.role !== "operator") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
