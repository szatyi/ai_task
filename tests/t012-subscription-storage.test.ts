import { beforeEach, describe, expect, it } from "vitest";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-012 subscription storage", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t012-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();

    await users.create({
      id: "usr_sub",
      email: "user+t012@example.com",
      displayName: "Subscriber",
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_operator_t012",
      email: "operator+t012@example.com",
      displayName: "Operator",
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_sub",
      name: "Subscription Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/t012.xml",
      triggerCondition: "contains:test",
      status: "enabled",
      createdByUserId: "usr_operator_t012",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("prevents duplicate user-rule-channel subscriptions", async () => {
    const subscriptions = new SqliteSubscriptionRepository();

    await subscriptions.create({
      id: "sub_1",
      userId: "usr_sub",
      alertRuleId: "rule_sub",
      channel: "email",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    await expect(
      subscriptions.create({
        id: "sub_2",
        userId: "usr_sub",
        alertRuleId: "rule_sub",
        channel: "email",
        status: "active",
        createdAt: "2026-06-09T00:00:00Z",
        updatedAt: "2026-06-09T00:00:00Z",
        deactivatedAt: null,
      }),
    ).rejects.toThrow();
  });

  it("marks subscriptions inactive instead of deleting", async () => {
    const subscriptions = new SqliteSubscriptionRepository();

    await subscriptions.create({
      id: "sub_3",
      userId: "usr_sub",
      alertRuleId: "rule_sub",
      channel: "slack",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      deactivatedAt: null,
    });

    const changed = await subscriptions.deactivate("sub_3", "2026-06-09T01:00:00Z");
    expect(changed).toBe(true);

    const found = await subscriptions.findByUserRuleAndChannel("usr_sub", "rule_sub", "slack");
    expect(found?.status).toBe("inactive");
    expect(found?.deactivatedAt).toBe("2026-06-09T01:00:00Z");

    const listed = await subscriptions.listByUser("usr_sub");
    expect(listed.some((item) => item.id === "sub_3")).toBe(true);
  });
});
