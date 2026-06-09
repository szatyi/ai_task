import { beforeEach, describe, expect, it } from "vitest";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteSessionRepository } from "@/infrastructure/repositories/sqlite-session-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

describe("T-010 core user and session storage", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t010-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();
  });

  it("stores users with both supported roles and disabled status", async () => {
    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_user",
      email: "user@example.com",
      displayName: "Standard User",
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await users.create({
      id: "usr_operator",
      email: "operator@example.com",
      displayName: "Operator",
      role: "operator",
      status: "disabled",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    const user = await users.findById("usr_user");
    const operator = await users.findById("usr_operator");

    expect(user?.role).toBe("user");
    expect(operator?.role).toBe("operator");
    expect(operator?.status).toBe("disabled");
  });

  it("enforces unique user emails", async () => {
    const users = new SqliteUserRepository();

    await users.create({
      id: "usr_1",
      email: "unique@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await expect(
      users.create({
        id: "usr_2",
        email: "unique@example.com",
        displayName: null,
        role: "operator",
        status: "active",
        createdAt: "2026-06-09T00:00:00Z",
        updatedAt: "2026-06-09T00:00:00Z",
      }),
    ).rejects.toThrow();
  });

  it("creates, reads, and invalidates sessions", async () => {
    const users = new SqliteUserRepository();
    const sessions = new SqliteSessionRepository();

    await users.create({
      id: "usr_session",
      email: "session@example.com",
      displayName: null,
      role: "user",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
    });

    await sessions.create({
      id: "sess_1",
      userId: "usr_session",
      sessionToken: "token_1",
      status: "active",
      createdAt: "2026-06-09T00:00:00Z",
      updatedAt: "2026-06-09T00:00:00Z",
      invalidatedAt: null,
    });

    const createdSession = await sessions.findByToken("token_1");
    expect(createdSession?.status).toBe("active");

    const invalidated = await sessions.invalidate("token_1", "2026-06-09T01:00:00Z");
    expect(invalidated).toBe(true);

    const invalidatedSession = await sessions.findByToken("token_1");
    expect(invalidatedSession?.status).toBe("invalidated");
    expect(invalidatedSession?.invalidatedAt).toBe("2026-06-09T01:00:00Z");
  });
});
