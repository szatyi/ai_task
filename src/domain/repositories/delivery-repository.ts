export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "skipped";
export type DeliveryChannel = "email" | "slack";

export interface Delivery {
  id: string;
  eventId: string;
  subscriptionId: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attemptCount: number;
  providerMessageId: string | null;
  failureRecordId: string | null;
  queuedAt: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface DeliveryRepository {
  create(delivery: Delivery): Promise<void>;
  findById(deliveryId: string): Promise<Delivery | null>;
  updateStatus(params: {
    deliveryId: string;
    status: DeliveryStatus;
    attemptCount: number;
    providerMessageId: string | null;
    failureRecordId: string | null;
    sentAt: string | null;
    updatedAt: string;
  }): Promise<boolean>;
}
