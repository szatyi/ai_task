import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const rules = new SqliteAlertRuleRepository();
    const items = await rules.list();

    return NextResponse.json({
      items: items.map((rule) => ({
        id: rule.id,
        name: rule.name,
        sourceType: rule.sourceType,
        sourceIdentifier: rule.sourceIdentifier,
        status: rule.status,
      })),
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

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as {
    name?: string;
    description?: string | null;
    sourceType?: "rss" | "api";
    sourceIdentifier?: string;
    triggerCondition?: string;
  };

  if (
    !payload.name ||
    !payload.sourceType ||
    !payload.sourceIdentifier ||
    !payload.triggerCondition ||
    !["rss", "api"].includes(payload.sourceType)
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Missing required fields" } },
      { status: 400 },
    );
  }

  try {
    ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    const operator = requireOperator(user);

    const rules = new SqliteAlertRuleRepository();
    const now = new Date().toISOString();
    const alertRule = {
      id: `rule_${randomUUID()}`,
      name: payload.name,
      description: payload.description ?? null,
      sourceType: payload.sourceType,
      sourceIdentifier: payload.sourceIdentifier,
      triggerCondition: payload.triggerCondition,
      status: "enabled" as const,
      createdByUserId: operator.id,
      createdAt: now,
      updatedAt: now,
    };

    await rules.create(alertRule);

    return NextResponse.json({
      alertRule: {
        id: alertRule.id,
        status: alertRule.status,
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
