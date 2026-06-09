import { beforeEach, describe, expect, it } from "vitest";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-014 delivery and failure record storage", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t014-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();
    const events = new SqliteEventRepository();

    await users.create({
      id: "usr_operator_t014",
      email: "operator+t014@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_t014",
      email: "user+t014@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_t014",
      name: "Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/t014.xml",
      triggerCondition: "contains:test",
      status: "enabled",
      createdByUserId: "usr_operator_t014",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_t014",
      userId: "usr_t014",
      alertRuleId: "rule_t014",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await events.create({
      id: "evt_t014",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/t014.xml",
      externalEventId: "item-1",
      dedupKey: "rss:t014:item-1",
      title: "Title",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T00:00:00Z",
      payloadJson: JSON.stringify({}),
      createdAt: "2026-06-09T00:00:00Z",
    });
  });

  it("prevents duplicate deliveries for same event-subscription-channel", async () => {
    const deliveries = new SqliteDeliveryRepository();

    await deliveries.create({
      id: "del_1",
      eventId: "evt_t014",
      subscriptionId: "sub_t014",
      channel: "email",
      status: "queued",
      attemptCount: 0,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: "2026-06-09T00:00:00Z",
      sentAt: null,
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await expect(
      deliveries.create({
        id: "del_2",
        eventId: "evt_t014",
        subscriptionId: "sub_t014",
        channel: "email",
        status: "queued",
        attemptCount: 0,
        providerMessageId: null,
        failureRecordId: null,
        queuedAt: "2026-06-09T00:00:00Z",
        sentAt: null,
        updatedAt: "2026-06-09T00:00:00Z",
      }),
    ).rejects.toThrow();
  });

  it("tracks state changes, attempt count, and linked failure records", async () => {
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    await deliveries.create({
      id: "del_3",
      eventId: "evt_t014",
      subscriptionId: "sub_t014",
      channel: "email",
      status: "queued",
      attemptCount: 0,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: "2026-06-09T00:00:00Z",
      sentAt: null,
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await failures.create({
      id: "fail_1",
      deliveryId: "del_3",
      failureType: "provider_error",
      providerName: "email",
      errorMessage: "SMTP timeout",
      errorCode: "TIMEOUT",
      failurePayloadJson: JSON.stringify({ retryable: true }),
      createdAt: "2026-06-09T00:01:00Z",
    });

    const updated = await deliveries.updateStatus({
      deliveryId: "del_3",
      status: "failed",
      attemptCount: 1,
      providerMessageId: null,
      failureRecordId: "fail_1",
      sentAt: null,
      updatedAt: "2026-06-09T00:01:00Z",
    });

    expect(updated).toBe(true);

    const delivery = await deliveries.findById("del_3");
    const failure = await failures.findByDeliveryId("del_3");

    expect(delivery?.status).toBe("failed");
    expect(delivery?.attemptCount).toBe(1);
    expect(delivery?.failureRecordId).toBe("fail_1");
    expect(failure?.errorMessage).toBe("SMTP timeout");
  });
});
