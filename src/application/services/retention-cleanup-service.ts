import type { DeliveryRepository } from "@/domain/repositories/delivery-repository";
import type { FailureRecordRepository } from "@/domain/repositories/failure-record-repository";

export type RetentionCleanupResult = {
  deletedDeliveries: number;
  deletedFailures: number;
  cutoffIso: string;
};

export class RetentionCleanupService {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly failures: FailureRecordRepository,
  ) {}

  async runCleanup(retentionHours: number): Promise<RetentionCleanupResult> {
    const cutoffIso = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();

    const deletedDeliveries = await this.deliveries.deleteOlderThan(cutoffIso);
    const deletedFailures = await this.failures.deleteOlderThan(cutoffIso);

    return {
      deletedDeliveries,
      deletedFailures,
      cutoffIso,
    };
  }
}
