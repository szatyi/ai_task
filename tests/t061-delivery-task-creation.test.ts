import { beforeEach, describe, expect, it } from "vitest";
import { DeliveryTaskService } from "@/application/services/delivery-task-service";
import { MatchingService } from "@/application/services/matching-service";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-061 delivery task creation with idempotency", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t061-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();

    await users.create({
      id: "usr_operator_t061",
      email: "operator+t061@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_subscriber_t061",
      email: "subscriber+t061@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_t061",
      name: "Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      triggerCondition: "contains:breaking",
      status: "enabled",
      createdByUserId: "usr_operator_t061",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_t061",
      userId: "usr_subscriber_t061",
      alertRuleId: "rule_t061",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });
  });

  it("creates delivery records from match candidates", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );
    const deliveryTasks = new DeliveryTaskService(new SqliteDeliveryRepository());

    const events = new SqliteEventRepository();
    await events.create({
      id: "evt_t061",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-1",
      dedupKey: "rss:https://example.com/feed.xml:item-1",
      title: "Breaking now",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    });

    const candidates = await matching.evaluateEvent({
      id: "evt_t061",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-1",
      dedupKey: "rss:https://example.com/feed.xml:item-1",
      title: "Breaking now",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    });

    const result = await deliveryTasks.createDeliveryTasks(candidates);

    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({
      eventId: "evt_t061",
      subscriptionId: "sub_t061",
      channel: "email",
      status: "queued",
      attemptCount: 0,
    });
    expect(result.existing).toHaveLength(0);
  });

  it("does not create duplicate deliveries for reprocessed events", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );
    const deliveryTasks = new DeliveryTaskService(new SqliteDeliveryRepository());

    const events = new SqliteEventRepository();
    await events.create({
      id: "evt_t061_dup",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-2",
      dedupKey: "rss:https://example.com/feed.xml:item-2",
      title: "Breaking duplicate",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    });

    const event = {
      id: "evt_t061_dup",
      sourceType: "rss" as const,
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-2",
      dedupKey: "rss:https://example.com/feed.xml:item-2",
      title: "Breaking duplicate",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    };

    const candidates = await matching.evaluateEvent(event);

    const first = await deliveryTasks.createDeliveryTasks(candidates);
    const second = await deliveryTasks.createDeliveryTasks(candidates);

    expect(first.created).toHaveLength(1);
    expect(second.created).toHaveLength(0);
    expect(second.existing).toHaveLength(1);
    expect(second.existing[0].eventId).toBe("evt_t061_dup");
  });

  it("persists centralized delivery state updates", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );
    const deliveries = new SqliteDeliveryRepository();
    const deliveryTasks = new DeliveryTaskService(deliveries);

    const events = new SqliteEventRepository();
    await events.create({
      id: "evt_t061_state",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-3",
      dedupKey: "rss:https://example.com/feed.xml:item-3",
      title: "Breaking state",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    });

    const candidates = await matching.evaluateEvent({
      id: "evt_t061_state",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-3",
      dedupKey: "rss:https://example.com/feed.xml:item-3",
      title: "Breaking state",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:10:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:10:01Z",
    });

    const created = await deliveryTasks.createDeliveryTasks(candidates);
    const deliveryId = created.created[0].id;

    const changed = await deliveryTasks.updateDeliveryState({
      deliveryId,
      status: "sending",
      attemptCount: 1,
      providerMessageId: null,
      failureRecordId: null,
      sentAt: null,
      updatedAt: "2026-06-09T12:11:00Z",
    });

    expect(changed).toBe(true);

    const stored = await deliveries.findById(deliveryId);
    expect(stored?.status).toBe("sending");
    expect(stored?.attemptCount).toBe(1);
  });
});
