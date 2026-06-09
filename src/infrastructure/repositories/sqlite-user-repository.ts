import type { User, UserRepository } from "@/domain/repositories/user-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "operator";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteUserRepository implements UserRepository {
  async create(user: User): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO users (id, email, display_name, role, status, created_at, updated_at)
      VALUES (@id, @email, @displayName, @role, @status, @createdAt, @updatedAt)
      `,
    ).run({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async findById(userId: string): Promise<User | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }
}
