import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import {
  GET as listSubscriptionsGet,
  POST as createSubscriptionPost,
} from "@/app/api/subscriptions/route";
import { PATCH as updateSubscriptionPatch } from "@/app/api/subscriptions/[subscriptionId]/route";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteAlertRuleRepository } from "@/infrastructure/repositories/sqlite-alert-rule-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function getCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return setCookieHeader.split(";")[0];
}

describe("T-030/T-031 subscription API", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t030-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();
    const rules = new SqliteAlertRuleRepository();

    await users.create({
      id: "usr_operator_t030",
      email: "operator+t030@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t030",
      email: "user+t030@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_enabled_t030",
      name: "Enabled Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/enabled.xml",
      triggerCondition: "contains:test",
      status: "enabled",
      createdByUserId: "usr_operator_t030",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await rules.create({
      id: "rule_disabled_t030",
      name: "Disabled Rule",
      description: null,
      sourceType: "rss",
      sourceIdentifier: "https://example.com/disabled.xml",
      triggerCondition: "contains:test",
      status: "disabled",
      createdByUserId: "usr_operator_t030",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("creates idempotent subscriptions for authenticated users", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user+t030@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const createFirst = await createSubscriptionPost(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ alertRuleId: "rule_enabled_t030", channel: "email" }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    const firstBody = (await createFirst.json()) as {
      subscription: { id: string; status: string };
    };

    const createSecond = await createSubscriptionPost(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ alertRuleId: "rule_enabled_t030", channel: "email" }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    const secondBody = (await createSecond.json()) as {
      subscription: { id: string; status: string };
    };

    expect(createFirst.status).toBe(200);
    expect(createSecond.status).toBe(200);
    expect(firstBody.subscription.id).toBe(secondBody.subscription.id);
    expect(secondBody.subscription.status).toBe("active");
  });

  it("lists user subscriptions and supports deactivation", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user+t030@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const createResponse = await createSubscriptionPost(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ alertRuleId: "rule_enabled_t030", channel: "slack" }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    const created = (await createResponse.json()) as { subscription: { id: string } };

    const listResponse = await listSubscriptionsGet(
      new Request("http://localhost/api/subscriptions", {
        method: "GET",
        headers: { cookie },
      }),
    );

    const listBody = (await listResponse.json()) as {
      items: Array<{ id: string; status: string }>;
    };
    expect(listBody.items.some((item) => item.id === created.subscription.id)).toBe(true);

    const patchResponse = await updateSubscriptionPatch(
      new Request(`http://localhost/api/subscriptions/${created.subscription.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
        headers: { "content-type": "application/json", cookie },
      }),
      { params: Promise.resolve({ subscriptionId: created.subscription.id }) },
    );

    expect(patchResponse.status).toBe(200);

    const updated = (await patchResponse.json()) as { subscription: { status: string } };
    expect(updated.subscription.status).toBe("inactive");
  });

  it("rejects invalid subscription payloads and disabled rules", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user+t030@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const invalidPayload = await createSubscriptionPost(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ alertRuleId: "rule_enabled_t030", channel: "sms" }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    const disabledRule = await createSubscriptionPost(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ alertRuleId: "rule_disabled_t030", channel: "email" }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    expect(invalidPayload.status).toBe(400);
    expect(disabledRule.status).toBe(404);
  });
});
