import { initializeDatabaseSchema } from "@/infrastructure/database/schema";

export function ensurePersistenceReady(): void {
  initializeDatabaseSchema();
}
