import { randomUUID } from "node:crypto";
import type { SessionRepository } from "@/domain/repositories/session-repository";
import type { User, UserRepository } from "@/domain/repositories/user-repository";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_CREDENTIALS"
      | "ACCOUNT_DISABLED"
      | "UNAUTHORIZED"
      | "EMAIL_ALREADY_EXISTS",
  ) {
    super(message);
  }
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async login(email: string): Promise<{ user: User; sessionToken: string }> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    if (user.status === "disabled") {
      throw new AuthError("Account is disabled", "ACCOUNT_DISABLED");
    }

    const now = new Date().toISOString();
    const sessionToken = randomUUID();

    await this.sessions.create({
      id: `sess_${randomUUID()}`,
      userId: user.id,
      sessionToken,
      status: "active",
      createdAt: now,
      updatedAt: now,
      invalidatedAt: null,
    });

    return { user, sessionToken };
  }

  async register(email: string, displayName: string): Promise<User> {
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new AuthError("Email already registered", "EMAIL_ALREADY_EXISTS");
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `user_${randomUUID()}`,
      email,
      displayName,
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await this.users.create(newUser);

    return newUser;
  }

  async me(sessionToken: string): Promise<User> {
    const session = await this.sessions.findByToken(sessionToken);

    if (!session || session.status !== "active") {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }

    const user = await this.users.findById(session.userId);

    if (!user || user.status === "disabled") {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }

    return user;
  }

  async logout(sessionToken: string): Promise<void> {
    const invalidated = await this.sessions.invalidate(sessionToken, new Date().toISOString());

    if (!invalidated) {
      throw new AuthError("Unauthorized", "UNAUTHORIZED");
    }
  }
}
