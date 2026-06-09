import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import {
  GET as adminListAlertRulesGet,
  POST as adminCreateAlertRulePost,
} from "@/app/api/admin/alert-rules/route";
import { PATCH as adminUpdateAlertRulePatch } from "@/app/api/admin/alert-rules/[alertRuleId]/route";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function getCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return setCookieHeader.split(";")[0];
}

describe("T-040/T-041 admin alert rule API", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t040-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_operator_t040",
      email: "operator+t040@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t040",
      email: "user+t040@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("allows operators to create and list alert rules", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "operator+t040@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const createResponse = await adminCreateAlertRulePost(
      new Request("http://localhost/api/admin/alert-rules", {
        method: "POST",
        body: JSON.stringify({
          name: "Breaking News",
          description: "Important updates",
          sourceType: "rss",
          sourceIdentifier: "https://example.com/feed.xml",
          triggerCondition: "contains:breaking",
        }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    expect(createResponse.status).toBe(200);

    const listResponse = await adminListAlertRulesGet(
      new Request("http://localhost/api/admin/alert-rules", {
        method: "GET",
        headers: { cookie },
      }),
    );

    const listBody = (await listResponse.json()) as {
      items: Array<{ name: string; status: string; sourceType: string }>;
    };

    expect(listBody.items.some((item) => item.name === "Breaking News")).toBe(true);
    expect(listBody.items[0].sourceType).toBe("rss");
  });

  it("rejects non-operators for admin routes", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user+t040@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const createResponse = await adminCreateAlertRulePost(
      new Request("http://localhost/api/admin/alert-rules", {
        method: "POST",
        body: JSON.stringify({
          name: "Should Fail",
          sourceType: "rss",
          sourceIdentifier: "https://example.com/feed.xml",
          triggerCondition: "contains:test",
        }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    expect(createResponse.status).toBe(403);
  });

  it("allows operators to update rule status", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "operator+t040@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookie = getCookie(loginResponse.headers.get("set-cookie"));

    const createResponse = await adminCreateAlertRulePost(
      new Request("http://localhost/api/admin/alert-rules", {
        method: "POST",
        body: JSON.stringify({
          name: "Toggle Rule",
          sourceType: "api",
          sourceIdentifier: "provider-1",
          triggerCondition: "type:error",
        }),
        headers: { "content-type": "application/json", cookie },
      }),
    );

    const created = (await createResponse.json()) as { alertRule: { id: string } };

    const patchResponse = await adminUpdateAlertRulePatch(
      new Request(`http://localhost/api/admin/alert-rules/${created.alertRule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "disabled" }),
        headers: { "content-type": "application/json", cookie },
      }),
      { params: Promise.resolve({ alertRuleId: created.alertRule.id }) },
    );

    expect(patchResponse.status).toBe(200);

    const body = (await patchResponse.json()) as { alertRule: { status: string } };
    expect(body.alertRule.status).toBe("disabled");
  });
});
