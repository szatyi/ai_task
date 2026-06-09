import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/services/authorization-service";
import { requireCurrentActiveUser } from "@/infrastructure/auth/require-user";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    ensurePersistenceReady();
    const user = await requireCurrentActiveUser(request);
    const subscriptions = new SqliteSubscriptionRepository();
    const rules = new SqliteAlertRuleRepository();

    const items = await subscriptions.listByUser(user.id);
    const ruleNames = new Map<string, string>();

    for (const subscription of items) {
      if (!ruleNames.has(subscription.alertRuleId)) {
        const rule = await rules.findById(subscription.alertRuleId);
        if (rule) {
          ruleNames.set(rule.id, rule.name);
        }
      }
    }

    return NextResponse.json({
      items: items.map((subscription) => ({
        id: subscription.id,
        alertRuleId: subscription.alertRuleId,
        alertRuleName: ruleNames.get(subscription.alertRuleId) ?? null,
        channel: subscription.channel,
        status: subscription.status,
      })),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    throw error;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as {
    alertRuleId?: string;
    channel?: "email" | "slack";
  };

  if (!payload.alertRuleId || !payload.channel || !["email", "slack"].includes(payload.channel)) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "alertRuleId and valid channel are required" } },
      { status: 400 },
    );
  }

  try {
    ensurePersistenceReady();
    const user = await requireCurrentActiveUser(request);

    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();

    const rule = await rules.findById(payload.alertRuleId);

    if (!rule || rule.status !== "enabled") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Alert rule not found" } },
        { status: 404 },
      );
    }

    const existing = await subscriptions.findByUserRuleAndChannel(
      user.id,
      payload.alertRuleId,
      payload.channel,
    );

    if (existing && existing.status === "active") {
      return NextResponse.json({
        subscription: {
          id: existing.id,
          alertRuleId: existing.alertRuleId,
          channel: existing.channel,
          status: existing.status,
        },
      });
    }

    if (existing && existing.status === "inactive") {
      const now = new Date().toISOString();
      await subscriptions.activate(existing.id, now);
      const reloaded = await subscriptions.findById(existing.id);

      return NextResponse.json({
        subscription: {
          id: reloaded?.id,
          alertRuleId: reloaded?.alertRuleId,
          channel: reloaded?.channel,
          status: reloaded?.status,
        },
      });
    }

    const now = new Date().toISOString();
    const subscription = {
      id: `sub_${randomUUID()}`,
      userId: user.id,
      alertRuleId: payload.alertRuleId,
      channel: payload.channel,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
    };

    await subscriptions.create(subscription);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        alertRuleId: subscription.alertRuleId,
        channel: subscription.channel,
        status: subscription.status,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    throw error;
  }
}
