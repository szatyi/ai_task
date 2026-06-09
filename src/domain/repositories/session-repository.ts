export type SessionStatus = "active" | "invalidated";

export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  invalidatedAt: string | null;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findByToken(sessionToken: string): Promise<Session | null>;
  invalidate(sessionToken: string, invalidatedAt: string): Promise<boolean>;
}
