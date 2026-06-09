import { randomUUID } from "node:crypto";
import type {
  Delivery,
  DeliveryRepository,
  DeliveryStatus,
} from "@/domain/repositories/delivery-repository";
import type { DeliveryCandidate } from "@/application/services/matching-service";

export type DeliveryTaskResult = {
  created: Delivery[];
  existing: Delivery[];
};

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export class DeliveryTaskService {
  constructor(private readonly deliveries: DeliveryRepository) {}

  async createDeliveryTasks(candidates: DeliveryCandidate[]): Promise<DeliveryTaskResult> {
    const created: Delivery[] = [];
    const existing: Delivery[] = [];

    for (const candidate of candidates) {
      const now = new Date().toISOString();
      const delivery: Delivery = {
        id: `del_${randomUUID()}`,
        eventId: candidate.eventId,
        subscriptionId: candidate.subscriptionId,
        channel: candidate.channel,
        status: "queued",
        attemptCount: 0,
        providerMessageId: null,
        failureRecordId: null,
        queuedAt: now,
        sentAt: null,
        updatedAt: now,
      };

      try {
        await this.deliveries.create(delivery);
        created.push(delivery);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const alreadyExisting = await this.deliveries.findByEventSubscriptionChannel(
          candidate.eventId,
          candidate.subscriptionId,
          candidate.channel,
        );

        if (!alreadyExisting) {
          throw error;
        }

        existing.push(alreadyExisting);
      }
    }

    return { created, existing };
  }

  async updateDeliveryState(params: {
    deliveryId: string;
    status: DeliveryStatus;
    attemptCount: number;
    providerMessageId: string | null;
    failureRecordId: string | null;
    sentAt: string | null;
    updatedAt: string;
  }): Promise<boolean> {
    return this.deliveries.updateStatus(params);
  }
}
