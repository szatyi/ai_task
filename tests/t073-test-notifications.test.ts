import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as testNotificationPost } from "@/app/api/admin/test-notifications/route";
import {
  getSqliteDatabase,
  resetSqliteDatabaseSingleton,
} from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function getCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return setCookieHeader.split(";")[0];
}

describe("T-073 test notifications", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t073-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    process.env.EMAIL_PROVIDER_MODE = "mock";
    process.env.SLACK_PROVIDER_MODE = "mock";
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_operator_t073",
      email: "operator+t073@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t073",
      email: "user+t073@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("allows operators to send test notifications", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "operator+t073@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await testNotificationPost(
      new Request("http://localhost/api/admin/test-notifications", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          channel: "email",
          target: "user@example.com",
          message: "Test message",
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: { status: string; channel: string; providerMessageId: string };
    };

    expect(body.result.status).toBe("sent");
    expect(body.result.channel).toBe("email");
    expect(body.result.providerMessageId).toContain("email_");
  });

  it("rejects non-operators and does not create delivery side effects", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user+t073@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await testNotificationPost(
      new Request("http://localhost/api/admin/test-notifications", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          channel: "slack",
          target: "#alerts",
          message: "Should fail",
        }),
      }),
    );

    expect(response.status).toBe(403);

    const db = getSqliteDatabase();
    const deliveryCount = db.prepare("SELECT COUNT(*) AS count FROM deliveries").get() as {
      count: number;
    };
    const subscriptionCount = db.prepare("SELECT COUNT(*) AS count FROM subscriptions").get() as {
      count: number;
    };

    expect(deliveryCount.count).toBe(0);
    expect(subscriptionCount.count).toBe(0);
  });

  it("returns clear failure when selected channel is not configured", async () => {
    process.env.SLACK_PROVIDER_MODE = "disabled";

    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "operator+t073@example.com" }),
      }),
    );

    const cookie = getCookie(login.headers.get("set-cookie"));

    const response = await testNotificationPost(
      new Request("http://localhost/api/admin/test-notifications", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          channel: "slack",
          target: "#alerts",
          message: "Check config",
        }),
      }),
    );

    expect(response.status).toBe(422);
  });
});
