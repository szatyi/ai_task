import { beforeEach, describe, expect, it } from "vitest";
import { MatchingService } from "@/application/services/matching-service";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-060 deterministic matching service", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t060-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();
    const subscriptions = new SqliteSubscriptionRepository();

    await users.create({
      id: "usr_operator_t060",
      email: "operator+t060@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_subscriber_t060",
      email: "subscriber+t060@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_enabled_t060",
      name: "Enabled Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      triggerCondition: "contains:breaking",
      status: "enabled",
      createdByUserId: "usr_operator_t060",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_disabled_t060",
      name: "Disabled Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      triggerCondition: "contains:breaking",
      status: "disabled",
      createdByUserId: "usr_operator_t060",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await subscriptions.create({
      id: "sub_enabled_t060",
      userId: "usr_subscriber_t060",
      alertRuleId: "rule_enabled_t060",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await subscriptions.create({
      id: "sub_disabled_rule_t060",
      userId: "usr_subscriber_t060",
      alertRuleId: "rule_disabled_t060",
      channel: "slack",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });
  });

  it("returns delivery candidates for a matching event", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );

    const candidates = await matching.evaluateEvent({
      id: "evt_t060",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-1",
      dedupKey: "rss:https://example.com/feed.xml:item-1",
      title: "Breaking update",
      summary: "Something breaking happened",
      eventUrl: null,
      occurredAt: "2026-06-09T12:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:00:01Z",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      eventId: "evt_t060",
      alertRuleId: "rule_enabled_t060",
      subscriptionId: "sub_enabled_t060",
      channel: "email",
    });
  });

  it("ignores disabled rules during matching", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );

    const candidates = await matching.evaluateEvent({
      id: "evt_t060_2",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-2",
      dedupKey: "rss:https://example.com/feed.xml:item-2",
      title: "Breaking once more",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T12:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:00:01Z",
    });

    expect(candidates.some((candidate) => candidate.alertRuleId === "rule_disabled_t060")).toBe(
      false,
    );
  });

  it("produces deterministic results for the same input event", async () => {
    const matching = new MatchingService(
      new SqliteAlertRuleRepository(),
      new SqliteSubscriptionRepository(),
    );

    const event = {
      id: "evt_t060_3",
      sourceType: "rss" as const,
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "item-3",
      dedupKey: "rss:https://example.com/feed.xml:item-3",
      title: "Breaking deterministic",
      summary: "deterministic",
      eventUrl: null,
      occurredAt: "2026-06-09T12:00:00Z",
      payloadJson: "{}",
      createdAt: "2026-06-09T12:00:01Z",
    };

    const first = await matching.evaluateEvent(event);
    const second = await matching.evaluateEvent(event);

    expect(first).toEqual(second);
  });
});
