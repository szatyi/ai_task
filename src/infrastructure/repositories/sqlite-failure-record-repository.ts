import type {
  FailureRecord,
  FailureRecordRepository,
} from "@/domain/repositories/failure-record-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type FailureRecordRow = {
  id: string;
  delivery_id: string;
  failure_type: string;
  provider_name: string;
  error_message: string;
  error_code: string | null;
  failure_payload_json: string | null;
  created_at: string;
};

function mapFailureRecordRow(row: FailureRecordRow): FailureRecord {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    failureType: row.failure_type,
    providerName: row.provider_name,
    errorMessage: row.error_message,
    errorCode: row.error_code,
    failurePayloadJson: row.failure_payload_json,
    createdAt: row.created_at,
  };
}

export class SqliteFailureRecordRepository implements FailureRecordRepository {
  async create(failureRecord: FailureRecord): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO failure_records (
        id, delivery_id, failure_type, provider_name, error_message,
        error_code, failure_payload_json, created_at
      )
      VALUES (
        @id, @deliveryId, @failureType, @providerName, @errorMessage,
        @errorCode, @failurePayloadJson, @createdAt
      )
      `,
    ).run({
      id: failureRecord.id,
      deliveryId: failureRecord.deliveryId,
      failureType: failureRecord.failureType,
      providerName: failureRecord.providerName,
      errorMessage: failureRecord.errorMessage,
      errorCode: failureRecord.errorCode,
      failurePayloadJson: failureRecord.failurePayloadJson,
      createdAt: failureRecord.createdAt,
    });
  }

  async findByDeliveryId(deliveryId: string): Promise<FailureRecord | null> {
    const db = getSqliteDatabase();
    const row = db
      .prepare("SELECT * FROM failure_records WHERE delivery_id = ?")
      .get(deliveryId) as FailureRecordRow | undefined;

    return row ? mapFailureRecordRow(row) : null;
  }
}
