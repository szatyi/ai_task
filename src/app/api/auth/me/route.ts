import { NextResponse } from "next/server";
import { AuthError } from "@/application/services/auth-service";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";
import { getSessionTokenFromCookieHeader } from "@/infrastructure/auth/request-auth";

export async function GET(request: Request): Promise<NextResponse> {
  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));

  if (!sessionToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const authService = createAuthService();

  try {
    const user = await authService.me(sessionToken);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
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
