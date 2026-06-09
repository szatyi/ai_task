import { NextResponse } from "next/server";
import { AuthError } from "@/application/services/auth-service";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";
import { SESSION_COOKIE_NAME } from "@/infrastructure/auth/session-cookie";

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as { email?: string };

  if (!payload.email) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "email is required" } },
      { status: 400 },
    );
  }

  const authService = createAuthService();

  try {
    const result = await authService.login(payload.email);
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError && error.code === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid credentials" } },
        { status: 401 },
      );
    }

    if (error instanceof AuthError && error.code === "ACCOUNT_DISABLED") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Account is disabled" } },
        { status: 403 },
      );
    }

    throw error;
  }
}
