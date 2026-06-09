import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { UserQueryService } from "@/application/services/user-query-service";
import {
  getSqliteDatabase,
  getSqliteDatabasePath,
  resetSqliteDatabaseSingleton,
} from "@/infrastructure/database/sqlite-client";
import { SqliteUnitOfWork } from "@/infrastructure/database/sqlite-unit-of-work";

function collectFilesRecursively(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFilesRecursively(fullPath);
    }

    return [fullPath];
  });
}

describe("T-002 SQLite persistence and repository interfaces", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    delete process.env.SQLITE_DB_PATH;
  });

  it("uses SQLite as the default database path", () => {
    const dbPath = getSqliteDatabasePath();
    const normalizedPath = dbPath.replace(/\\/g, "/");

    expect(normalizedPath.endsWith("/data/alerting.sqlite")).toBe(true);
  });

  it("supports transaction handling for application services", async () => {
    process.env.SQLITE_DB_PATH = "data/test-t002.sqlite";

    const db = getSqliteDatabase();
    db.exec("DROP TABLE IF EXISTS tx_test;");
    db.exec("CREATE TABLE tx_test (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");

    const uow = new SqliteUnitOfWork();

    await uow.transaction(async () => {
      db.prepare("INSERT INTO tx_test (value) VALUES (?)").run("committed");
      return Promise.resolve();
    });

    await expect(
      uow.transaction(async () => {
        db.prepare("INSERT INTO tx_test (value) VALUES (?)").run("rolled-back");
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const rows = db.prepare("SELECT value FROM tx_test ORDER BY id").all() as Array<{
      value: string;
    }>;

    expect(rows).toEqual([{ value: "committed" }]);
  });

  it("keeps UI code free of direct database imports", () => {
    const appDir = path.resolve(process.cwd(), "src/app");
    const appFiles = collectFilesRecursively(appDir).filter(
      (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"),
    );

    for (const filePath of appFiles) {
      const content = readFileSync(filePath, "utf8");
      expect(content.includes("@/infrastructure/database")).toBe(false);
    }
  });

  it("application services depend on repository interfaces", async () => {
    const fakeRepository = {
      async create() {
        return Promise.resolve();
      },
      async findById(userId: string) {
        return {
          id: userId,
          email: "user@example.com",
          displayName: "User",
          role: "user" as const,
          status: "active" as const,
          createdAt: "2026-06-09T00:00:00Z",
          updatedAt: "2026-06-09T00:00:00Z",
        };
      },
      async findByEmail() {
        return null;
      },
    };

    const service = new UserQueryService(fakeRepository);
    const user = await service.getUser("usr_1");

    expect(user?.id).toBe("usr_1");
    expect(
      existsSync(path.resolve(process.cwd(), "src/domain/repositories/user-repository.ts")),
    ).toBe(true);
  });
});
