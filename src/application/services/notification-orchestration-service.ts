import { randomUUID } from "node:crypto";
import type { DeliveryRepository } from "@/domain/repositories/delivery-repository";
import type { FailureRecordRepository } from "@/domain/repositories/failure-record-repository";
import type {
  NotificationMessage,
  NotificationProviderMap,
} from "@/application/ports/notification-provider";

export type DeliveryProcessResult = {
  status: "sent" | "failed" | "skipped";
  deliveryId: string;
  attemptCount: number;
};

export class NotificationOrchestrationService {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly failures: FailureRecordRepository,
    private readonly providers: NotificationProviderMap,
  ) {}

  async processDelivery(
    deliveryId: string,
    message: NotificationMessage,
  ): Promise<DeliveryProcessResult> {
    const delivery = await this.deliveries.findById(deliveryId);

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status === "sent" || delivery.status === "skipped") {
      return {
        status: "skipped",
        deliveryId,
        attemptCount: delivery.attemptCount,
      };
    }

    const provider = this.providers[delivery.channel];
    const now = new Date().toISOString();
    const nextAttemptCount = delivery.attemptCount + 1;

    await this.deliveries.updateStatus({
      deliveryId,
      status: "sending",
      attemptCount: nextAttemptCount,
      providerMessageId: delivery.providerMessageId,
      failureRecordId: delivery.failureRecordId,
      sentAt: delivery.sentAt,
      updatedAt: now,
    });

    if (!provider) {
      await this.deliveries.updateStatus({
        deliveryId,
        status: "skipped",
        attemptCount: nextAttemptCount,
        providerMessageId: delivery.providerMessageId,
        failureRecordId: delivery.failureRecordId,
        sentAt: delivery.sentAt,
        updatedAt: new Date().toISOString(),
      });

      return {
        status: "skipped",
        deliveryId,
        attemptCount: nextAttemptCount,
      };
    }

    try {
      const result = await provider.send(message);
      const sentAt = new Date().toISOString();

      await this.deliveries.updateStatus({
        deliveryId,
        status: "sent",
        attemptCount: nextAttemptCount,
        providerMessageId: result.providerMessageId,
        failureRecordId: null,
        sentAt,
        updatedAt: sentAt,
      });

      return {
        status: "sent",
        deliveryId,
        attemptCount: nextAttemptCount,
      };
    } catch (error) {
      const failureId = `fail_${randomUUID()}`;
      const failedAt = new Date().toISOString();

      await this.failures.create({
        id: failureId,
        deliveryId,
        failureType: "provider_failure",
        providerName: delivery.channel,
        errorMessage: error instanceof Error ? error.message : "Unknown provider failure",
        errorCode: null,
        failurePayloadJson: null,
        createdAt: failedAt,
      });

      await this.deliveries.updateStatus({
        deliveryId,
        status: "failed",
        attemptCount: nextAttemptCount,
        providerMessageId: delivery.providerMessageId,
        failureRecordId: failureId,
        sentAt: null,
        updatedAt: failedAt,
      });

      return {
        status: "failed",
        deliveryId,
        attemptCount: nextAttemptCount,
      };
    }
  }
}
