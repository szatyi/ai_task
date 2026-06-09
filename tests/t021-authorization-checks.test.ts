import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as adminAccessCheckGet } from "@/app/api/admin/access-check/route";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteSessionRepository } from "@/infrastructure/repositories/sqlite-session-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return setCookieHeader.split(";")[0];
}

describe("T-021 role-based authorization checks", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t021-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_operator_t021",
      email: "operator+t021@example.com",
      displayName: null,
      role: "operator",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_user_t021",
      email: "user+t021@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_disabled_t021",
      email: "disabled+t021@example.com",
      displayName: null,
      role: "operator",
      status: "disabled",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("allows operators and rejects non-operators on operator routes", async () => {
    const operatorLogin = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "operator+t021@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const userLogin = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "user+t021@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const operatorCookie = extractSessionCookie(operatorLogin.headers.get("set-cookie"));
    const userCookie = extractSessionCookie(userLogin.headers.get("set-cookie"));

    const operatorResult = await adminAccessCheckGet(
      new Request("http://localhost/api/admin/access-check", {
        method: "GET",
        headers: { cookie: operatorCookie },
      }),
    );

    const userResult = await adminAccessCheckGet(
      new Request("http://localhost/api/admin/access-check", {
        method: "GET",
        headers: { cookie: userCookie },
      }),
    );

    expect(operatorResult.status).toBe(200);
    expect(userResult.status).toBe(403);
  });

  it("rejects disabled users for protected actions", async () => {
    const sessions = new SqliteSessionRepository();

    await sessions.create({
      id: "sess_disabled",
      userId: "usr_disabled_t021",
      sessionToken: "disabled-token",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      invalidatedAt: null,
    });

    const result = await adminAccessCheckGet(
      new Request("http://localhost/api/admin/access-check", {
        method: "GET",
        headers: { cookie: "session_token=disabled-token" },
      }),
    );

    expect(result.status).toBe(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const result = await adminAccessCheckGet(
      new Request("http://localhost/api/admin/access-check", {
        method: "GET",
      }),
    );

    expect(result.status).toBe(401);
  });
});
