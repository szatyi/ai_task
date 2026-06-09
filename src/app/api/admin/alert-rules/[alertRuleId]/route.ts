import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ alertRuleId: string }> },
): Promise<NextResponse> {
  const payload = (await request.json()) as { status?: "enabled" | "disabled" };
  const { alertRuleId } = await params;

  if (!payload.status || !["enabled", "disabled"].includes(payload.status)) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "status must be enabled or disabled" } },
      { status: 400 },
    );
  }

  try {
    await ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const rules = new SqliteAlertRuleRepository();
    const changed = await rules.updateStatus(alertRuleId, payload.status, new Date().toISOString());

    if (!changed) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Alert rule not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      alertRule: {
        id: alertRuleId,
        status: payload.status,
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
