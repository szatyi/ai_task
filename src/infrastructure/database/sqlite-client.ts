import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DEFAULT_SQLITE_RELATIVE_PATH = "data/alerting.sqlite";

let database: Database.Database | null = null;

export function getSqliteDatabasePath(): string {
  const configuredPath = process.env.SQLITE_DB_PATH;
  const relativeOrAbsolutePath = configuredPath ?? DEFAULT_SQLITE_RELATIVE_PATH;

  return path.resolve(process.cwd(), relativeOrAbsolutePath);
}

export function getSqliteDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const dbPath = getSqliteDatabasePath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  database = new Database(dbPath);
  database.pragma("foreign_keys = ON");

  return database;
}

export function resetSqliteDatabaseSingleton(): void {
  if (database) {
    database.close();
    database = null;
  }
}
