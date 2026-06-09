import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

export class SqliteUnitOfWork implements UnitOfWork {
  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const db = getSqliteDatabase();

    db.prepare("BEGIN").run();

    try {
      const result = await operation();
      db.prepare("COMMIT").run();
      return result;
    } catch (error) {
      db.prepare("ROLLBACK").run();
      throw error;
    }
  }
}
