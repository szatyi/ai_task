import { NextResponse } from "next/server";
import { AuthError } from "@/application/services/auth-service";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as { email?: string; displayName?: string };

  if (!payload.email || !payload.displayName) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "email and displayName are required" } },
      { status: 400 },
    );
  }

  const authService = createAuthService();

  try {
    const user = await authService.register(payload.email, payload.displayName);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError && error.code === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Email already registered" } },
        { status: 409 },
      );
    }

    throw error;
  }
}
