import type { Session, SessionRepository } from "@/domain/repositories/session-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type SessionRow = {
  id: string;
  user_id: string;
  session_token: string;
  status: "active" | "invalidated";
  created_at: string;
  updated_at: string;
  invalidated_at: string | null;
};

function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    sessionToken: row.session_token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invalidatedAt: row.invalidated_at,
  };
}

export class SqliteSessionRepository implements SessionRepository {
  async create(session: Session): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO sessions (id, user_id, session_token, status, created_at, updated_at, invalidated_at)
      VALUES (@id, @userId, @sessionToken, @status, @createdAt, @updatedAt, @invalidatedAt)
      `,
    ).run({
      id: session.id,
      userId: session.userId,
      sessionToken: session.sessionToken,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      invalidatedAt: session.invalidatedAt,
    });
  }

  async findByToken(sessionToken: string): Promise<Session | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM sessions WHERE session_token = ?").get(sessionToken) as
      | SessionRow
      | undefined;

    return row ? mapSessionRow(row) : null;
  }

  async invalidate(sessionToken: string, invalidatedAt: string): Promise<boolean> {
    const db = getSqliteDatabase();
    const result = db
      .prepare(
        `
        UPDATE sessions
        SET status = 'invalidated', invalidated_at = @invalidatedAt, updated_at = @invalidatedAt
        WHERE session_token = @sessionToken AND status = 'active'
        `,
      )
      .run({ sessionToken, invalidatedAt });

    return result.changes > 0;
  }
}
