import { beforeEach, describe, expect, it } from "vitest";
import { runDeliveryWorkerOnce } from "@/infrastructure/jobs/background-worker-entry";
import { runRetentionCleanupOnce } from "@/infrastructure/jobs/retention-cleanup-job";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-090/T-100 background workers and retention", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t090-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    process.env.EMAIL_PROVIDER_MODE = "mock";
    process.env.SLACK_PROVIDER_MODE = "mock";
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();
    const events = new SqliteEventRepository();
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    await users.create({
      id: "usr_operator_t090",
      email: "operator+t090@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t090",
      email: "user+t090@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_t090",
      name: "Rule",
      description: null,
      sourceType: "api",
      sourceIdentifier: "provider-t090",
      triggerCondition: "contains:alert",
      status: "enabled",
      createdByUserId: "usr_operator_t090",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_t090",
      userId: "usr_user_t090",
      alertRuleId: "rule_t090",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await events.create({
      id: "evt_t090",
      sourceType: "api",
      sourceIdentifier: "provider-t090",
      externalEventId: "event-1",
      dedupKey: "api:provider-t090:event-1",
      title: "Alert",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T13:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T13:00:01Z",
    });

    await deliveries.create({
      id: "del_t090_queued",
      eventId: "evt_t090",
      subscriptionId: "sub_t090",
      channel: "email",
      status: "queued",
      attemptCount: 0,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: new Date().toISOString(),
      sentAt: null,
      updatedAt: new Date().toISOString(),
    });

    await deliveries.create({
      id: "del_t090_old",
      eventId: "evt_t090",
      subscriptionId: "sub_t090",
      channel: "slack",
      status: "failed",
      attemptCount: 1,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: "2020-01-01T00:00:00.000Z",
      sentAt: null,
      updatedAt: "2020-01-01T00:00:00.000Z",
    });

    await failures.create({
      id: "fail_t090_old",
      deliveryId: "del_t090_old",
      failureType: "provider_failure",
      providerName: "slack",
      errorMessage: "old failure",
      errorCode: null,
      failurePayloadJson: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
  });

  it("processes queued deliveries from a shared background entry point", async () => {
    const processedCount = await runDeliveryWorkerOnce();

    expect(processedCount).toBe(1);

    const deliveries = new SqliteDeliveryRepository();
    const updated = await deliveries.findById("del_t090_queued");

    expect(updated?.status).toBe("sent");
    expect(updated?.attemptCount).toBe(1);
  });

  it("cleans up operational records older than retention window", async () => {
    const result = await runRetentionCleanupOnce(24);

    expect(result.deletedDeliveries).toBeGreaterThanOrEqual(1);
    expect(result.deletedFailures).toBeGreaterThanOrEqual(1);

    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    const recentDeliveries = await deliveries.listRecent({ limit: 1000 });
    const recentFailures = await failures.listRecent(1000);

    expect(recentDeliveries.some((item) => item.id === "del_t090_old")).toBe(false);
    expect(recentFailures.some((item) => item.id === "fail_t090_old")).toBe(false);
  });
});
