import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationOrchestrationService } from "@/application/services/notification-orchestration-service";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-070 notification orchestration", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t070-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();
    const events = new SqliteEventRepository();
    const deliveries = new SqliteDeliveryRepository();

    await users.create({
      id: "usr_operator_t070",
      email: "operator+t070@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_subscriber_t070",
      email: "subscriber+t070@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_t070",
      name: "Rule",
      description: null,
      sourceType: "api",
      sourceIdentifier: "provider-t070",
      triggerCondition: "contains:alert",
      status: "enabled",
      createdByUserId: "usr_operator_t070",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_t070",
      userId: "usr_subscriber_t070",
      alertRuleId: "rule_t070",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await events.create({
      id: "evt_t070",
      sourceType: "api",
      sourceIdentifier: "provider-t070",
      externalEventId: "event-1",
      dedupKey: "api:provider-t070:event-1",
      title: "Alert",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T13:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T13:00:01Z",
    });

    await deliveries.create({
      id: "del_t070",
      eventId: "evt_t070",
      subscriptionId: "sub_t070",
      channel: "email",
      status: "queued",
      attemptCount: 0,
      providerMessageId: null,
      failureRecordId: null,
      queuedAt: "2026-06-09T13:00:02Z",
      sentAt: null,
      updatedAt: "2026-06-09T13:00:02Z",
    });
  });

  it("moves delivery state from queued to sent and tracks attempts", async () => {
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    const emailSend = vi.fn(async () => ({ providerMessageId: "msg-1" }));

    const orchestration = new NotificationOrchestrationService(deliveries, failures, {
      email: { send: emailSend },
    });

    const result = await orchestration.processDelivery("del_t070", {
      subject: "Alert",
      body: "Body",
    });

    expect(result.status).toBe("sent");
    expect(result.attemptCount).toBe(1);

    const stored = await deliveries.findById("del_t070");
    expect(stored?.status).toBe("sent");
    expect(stored?.attemptCount).toBe(1);
    expect(stored?.providerMessageId).toBe("msg-1");
  });

  it("prevents duplicate notifications when reprocessing sent deliveries", async () => {
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    const emailSend = vi.fn(async () => ({ providerMessageId: "msg-2" }));

    const orchestration = new NotificationOrchestrationService(deliveries, failures, {
      email: { send: emailSend },
    });

    const first = await orchestration.processDelivery("del_t070", {
      subject: "Alert",
      body: "Body",
    });

    const second = await orchestration.processDelivery("del_t070", {
      subject: "Alert",
      body: "Body",
    });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("skipped");
    expect(emailSend).toHaveBeenCalledTimes(1);
  });

  it("records failed state and failure details on provider errors", async () => {
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    const failingSend = vi.fn(async () => {
      throw new Error("provider timeout");
    });

    const orchestration = new NotificationOrchestrationService(deliveries, failures, {
      email: { send: failingSend },
    });

    const result = await orchestration.processDelivery("del_t070", {
      subject: "Alert",
      body: "Body",
    });

    expect(result.status).toBe("failed");

    const stored = await deliveries.findById("del_t070");
    expect(stored?.status).toBe("failed");
    expect(stored?.attemptCount).toBe(1);
    expect(stored?.failureRecordId).not.toBeNull();

    const failure = await failures.findByDeliveryId("del_t070");
    expect(failure?.errorMessage).toBe("provider timeout");
  });
});
