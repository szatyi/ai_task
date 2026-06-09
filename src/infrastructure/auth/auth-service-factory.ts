import { AuthService } from "@/application/services/auth-service";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteSessionRepository } from "@/infrastructure/repositories/sqlite-session-repository";
import { SqliteUserRepository } from "@/infrastructure/repositories/sqlite-user-repository";

export function createAuthService(): AuthService {
  initializeDatabaseSchema();
  return new AuthService(new SqliteUserRepository(), new SqliteSessionRepository());
}
