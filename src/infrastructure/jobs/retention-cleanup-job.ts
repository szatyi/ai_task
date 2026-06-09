import { RetentionCleanupService } from "@/application/services/retention-cleanup-service";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";

export type RetentionCleanupJobHandle = {
  stop: () => void;
};

export async function runRetentionCleanupOnce(retentionHours = 24): Promise<{
  deletedDeliveries: number;
  deletedFailures: number;
  cutoffIso: string;
}> {
  ensurePersistenceReady();

  const service = new RetentionCleanupService(
    new SqliteDeliveryRepository(),
    new SqliteFailureRecordRepository(),
  );

  return service.runCleanup(retentionHours);
}

export function startRetentionCleanupJob(params: {
  intervalMs: number;
  retentionHours?: number;
}): RetentionCleanupJobHandle {
  const timer = setInterval(async () => {
    await runRetentionCleanupOnce(params.retentionHours ?? 24);
  }, params.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
