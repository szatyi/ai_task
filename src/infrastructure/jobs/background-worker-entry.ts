import { NotificationOrchestrationService } from "@/application/services/notification-orchestration-service";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { buildConfiguredProviders } from "@/infrastructure/providers/provider-factory";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";

export async function runDeliveryWorkerOnce(): Promise<number> {
  ensurePersistenceReady();

  const deliveries = new SqliteDeliveryRepository();
  const failures = new SqliteFailureRecordRepository();

  const orchestration = new NotificationOrchestrationService(
    deliveries,
    failures,
    buildConfiguredProviders(),
  );

  const queued = await deliveries.listRecent({ status: "queued", limit: 100 });

  for (const delivery of queued) {
    await orchestration.processDelivery(delivery.id, {
      subject: "Alert notification",
      body: "Automated delivery",
    });
  }

  return queued.length;
}
