import { NextResponse } from "next/server";
import { AuthError } from "@/application/services/auth-service";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";
import { SESSION_COOKIE_NAME } from "@/infrastructure/auth/session-cookie";
import { getSessionTokenFromCookieHeader } from "@/infrastructure/auth/request-auth";

export async function POST(request: Request): Promise<NextResponse> {
  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));

  if (!sessionToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const authService = createAuthService();

  try {
    await authService.logout(sessionToken);
    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    throw error;
  }
}
