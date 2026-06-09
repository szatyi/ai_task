import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as monitoringSummaryGet } from "@/app/api/admin/monitoring/summary/route";
import { GET as deliveriesGet } from "@/app/api/admin/deliveries/route";
import { GET as failuresGet } from "@/app/api/admin/failures/route";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function getCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return setCookieHeader.split(";")[0];
}

describe("T-080/T-081/T-082 admin monitoring APIs", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t080-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();
    const events = new SqliteEventRepository();
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    await users.create({
      id: "usr_operator_t080",
      email: "operator+t080@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t080",
      email: "user+t080@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_t080",
      name: "Rule",
      description: null,
      sourceType: "api",
      sourceIdentifier: "provider-t080",
      triggerCondition: "contains:alert",
      status: "enabled",
      createdByUserId: "usr_operator_t080",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_active_t080",
      userId: "usr_user_t080",
      alertRuleId: "rule_t080",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await subscriptions.create({
      id: "sub_active_t080_slack",
      userId: "usr_user_t080",
      alertRuleId: "rule_t080",
      channel: "slack",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await events.create({
      id: "evt_t080",
      sourceType: "api",
      sourceIdentifier: "provider-t080",
      externalEventId: "event-1",
      dedupKey: "api:provider-t080:event-1",
      title: "Alert",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T13:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T13:00:01Z",
    });

    await deliveries.create({
      id: "del_t080_sent",
      eventId: "evt_t080",
      subscriptionId: "sub_active_t080",
      channel: "email",
      status: "sent",
      attemptCount: 1,
      providerMessageId: "msg-1",
      failureRecordId: null,
      queuedAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await deliveries.create({
      id: "del_t080_failed",
      eventId: "evt_t080",
      subscriptionId: "sub_active_t080_slack",
      channel: "slack",
      status: "failed",
      attemptCount: 1,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: new Date().toISOString(),
      sentAt: null,
      updatedAt: new Date().toISOString(),
    });

    await failures.create({
      id: "fail_t080_recent",
      deliveryId: "del_t080_failed",
      failureType: "provider_failure",
      providerName: "email",
      errorMessage: "timeout",
      errorCode: null,
      failurePayloadJson: null,
      createdAt: new Date().toISOString(),
    });

    await failures.create({
      id: "fail_t080_old",
      deliveryId: "del_t080_sent",
      failureType: "provider_failure",
      providerName: "email",
      errorMessage: "old",
      errorCode: null,
      failurePayloadJson: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
  });

  it("returns monitoring summary for operators", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "operator+t080@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await monitoringSummaryGet(
      new Request("http://localhost/api/admin/monitoring/summary", {
        method: "GET",
        headers: { cookie },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      activeSubscriptions: number;
      recentDeliveries: number;
      recentFailures: number;
      health: string;
    };

    expect(body.activeSubscriptions).toBe(2);
    expect(body.recentDeliveries).toBe(2);
    expect(body.recentFailures).toBe(1);
    expect(body.health).toBe("degraded");
  });

  it("lists deliveries with status, channel, and limit filters", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "operator+t080@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await deliveriesGet(
      new Request("http://localhost/api/admin/deliveries?status=sent&channel=email&limit=1", {
        method: "GET",
        headers: { cookie },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      items: Array<{ id: string; status: string; channel: string }>;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe("sent");
    expect(body.items[0].channel).toBe("email");
  });

  it("lists only recent failures within retention window", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "operator+t080@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await failuresGet(
      new Request("http://localhost/api/admin/failures", {
        method: "GET",
        headers: { cookie },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      items: Array<{ id: string; errorMessage: string }>;
    };

    expect(body.items.some((item) => item.id === "fail_t080_recent")).toBe(true);
    expect(body.items.some((item) => item.id === "fail_t080_old")).toBe(false);
  });
});
