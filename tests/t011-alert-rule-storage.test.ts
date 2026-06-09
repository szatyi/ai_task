import { beforeEach, describe, expect, it } from "vitest";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-011 alert rule storage", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t011-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    await users.create({
      id: "usr_operator",
      email: "operator+t011@example.com",
      displayName: "Operator",
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("creates rules with required fields and ownership", async () => {
    const rules = new SqliteAlertRuleRepository();

    await rules.create({
      id: "rule_1",
      name: "Breaking News",
      description: "Important updates",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      triggerCondition: "contains:breaking",
      status: "enabled",
      createdByUserId: "usr_operator",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    const stored = await rules.findById("rule_1");

    expect(stored?.status).toBe("enabled");
    expect(stored?.sourceType).toBe("rss");
    expect(stored?.sourceIdentifier).toBe("https://example.com/feed.xml");
    expect(stored?.createdByUserId).toBe("usr_operator");
  });

  it("supports enabling and disabling rules", async () => {
    const rules = new SqliteAlertRuleRepository();

    await rules.create({
      id: "rule_2",
      name: "API Alerts",
      description: null,
      sourceType: "api",
      sourceIdentifier: "provider-1",
      triggerCondition: "type:error",
      status: "enabled",
      createdByUserId: "usr_operator",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    const changed = await rules.updateStatus("rule_2", "disabled", "2026-06-09T01:00:00Z");
    expect(changed).toBe(true);

    const stored = await rules.findById("rule_2");
    expect(stored?.status).toBe("disabled");
  });
});
