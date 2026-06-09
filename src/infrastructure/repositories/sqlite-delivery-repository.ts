import type { Delivery, DeliveryRepository } from "@/domain/repositories/delivery-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type DeliveryRow = {
  id: string;
  event_id: string;
  subscription_id: string;
  channel: "email" | "slack";
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  attempt_count: number;
  provider_message_id: string | null;
  failure_record_id: string | null;
  queued_at: string;
  sent_at: string | null;
  updated_at: string;
};

function mapDeliveryRow(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    eventId: row.event_id,
    subscriptionId: row.subscription_id,
    channel: row.channel,
    status: row.status,
    attemptCount: row.attempt_count,
    providerMessageId: row.provider_message_id,
    failureRecordId: row.failure_record_id,
    queuedAt: row.queued_at,
    sentAt: row.sent_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteDeliveryRepository implements DeliveryRepository {
  async create(delivery: Delivery): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO deliveries (
        id, event_id, subscription_id, channel, status,
        attempt_count, provider_message_id, failure_record_id,
        queued_at, sent_at, updated_at
      )
      VALUES (
        @id, @eventId, @subscriptionId, @channel, @status,
        @attemptCount, @providerMessageId, @failureRecordId,
        @queuedAt, @sentAt, @updatedAt
      )
      `,
    ).run({
      id: delivery.id,
      eventId: delivery.eventId,
      subscriptionId: delivery.subscriptionId,
      channel: delivery.channel,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      providerMessageId: delivery.providerMessageId,
      failureRecordId: delivery.failureRecordId,
      queuedAt: delivery.queuedAt,
      sentAt: delivery.sentAt,
      updatedAt: delivery.updatedAt,
    });
  }

  async findById(deliveryId: string): Promise<Delivery | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(deliveryId) as
      | DeliveryRow
      | undefined;

    return row ? mapDeliveryRow(row) : null;
  }

  async updateStatus(params: {
    deliveryId: string;
    status: "queued" | "sending" | "sent" | "failed" | "skipped";
    attemptCount: number;
    providerMessageId: string | null;
    failureRecordId: string | null;
    sentAt: string | null;
    updatedAt: string;
  }): Promise<boolean> {
    const db = getSqliteDatabase();
    const result = db
      .prepare(
        `
        UPDATE deliveries
        SET
          status = @status,
          attempt_count = @attemptCount,
          provider_message_id = @providerMessageId,
          failure_record_id = @failureRecordId,
          sent_at = @sentAt,
          updated_at = @updatedAt
        WHERE id = @deliveryId
        `,
      )
      .run(params);

    return result.changes > 0;
  }
}
