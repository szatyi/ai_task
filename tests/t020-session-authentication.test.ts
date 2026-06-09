import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  const tokenPart = setCookieHeader.split(";")[0];

  return tokenPart;
}

describe("T-020 session-based authentication", () => {
  beforeEach(async () => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t020-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();

    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_auth",
      email: "auth@example.com",
      displayName: "Auth User",
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_disabled",
      email: "disabled@example.com",
      displayName: null,
      role: "user",
      status: "disabled",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });
  });

  it("logs in and returns current authenticated user from /api/auth/me", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "auth@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(loginResponse.status).toBe(200);

    const cookieHeader = extractSessionCookie(loginResponse.headers.get("set-cookie"));

    const meResponse = await meGet(
      new Request("http://localhost/api/auth/me", {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
    );

    expect(meResponse.status).toBe(200);

    const meBody = (await meResponse.json()) as {
      user: { email: string; role: "user" | "operator" };
    };

    expect(meBody.user.email).toBe("auth@example.com");
    expect(meBody.user.role).toBe("user");
  });

  it("logs out and invalidates the session", async () => {
    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "auth@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const cookieHeader = extractSessionCookie(loginResponse.headers.get("set-cookie"));

    const logoutResponse = await logoutPost(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: cookieHeader },
      }),
    );

    expect(logoutResponse.status).toBe(200);

    const meResponse = await meGet(
      new Request("http://localhost/api/auth/me", {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
    );

    expect(meResponse.status).toBe(401);
  });

  it("rejects login for disabled users", async () => {
    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "disabled@example.com" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
  });
});
