import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const operator = requireOperator(user);

    return NextResponse.json({
      user: {
        id: operator.id,
        email: operator.email,
        role: operator.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    if (error instanceof AuthorizationError && error.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Forbidden" } },
        { status: 403 },
      );
    }

    throw error;
  }
}
