import type { User } from "@/domain/repositories/user-repository";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: "FORBIDDEN" | "UNAUTHORIZED",
  ) {
    super(message);
  }
}

export function requireActiveUser(user: User | null): User {
  if (!user || user.status !== "active") {
    throw new AuthorizationError("Unauthorized", "UNAUTHORIZED");
  }

  return user;
}

export function requireOperator(user: User | null): User {
  const activeUser = requireActiveUser(user);

  if (activeUser.role !== "operator") {
    throw new AuthorizationError("Forbidden", "FORBIDDEN");
  }

  return activeUser;
}
