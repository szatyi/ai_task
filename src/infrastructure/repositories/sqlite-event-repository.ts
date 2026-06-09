import type { Event, EventRepository } from "@/domain/repositories/event-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type EventRow = {
  id: string;
  source_type: "rss" | "api";
  source_identifier: string;
  external_event_id: string;
  dedup_key: string;
  title: string;
  summary: string | null;
  event_url: string | null;
  occurred_at: string;
  payload_json: string;
  created_at: string;
};

function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceIdentifier: row.source_identifier,
    externalEventId: row.external_event_id,
    dedupKey: row.dedup_key,
    title: row.title,
    summary: row.summary,
    eventUrl: row.event_url,
    occurredAt: row.occurred_at,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
  };
}

export class SqliteEventRepository implements EventRepository {
  async create(event: Event): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO events (
        id, source_type, source_identifier, external_event_id, dedup_key,
        title, summary, event_url, occurred_at, payload_json, created_at
      )
      VALUES (
        @id, @sourceType, @sourceIdentifier, @externalEventId, @dedupKey,
        @title, @summary, @eventUrl, @occurredAt, @payloadJson, @createdAt
      )
      `,
    ).run({
      id: event.id,
      sourceType: event.sourceType,
      sourceIdentifier: event.sourceIdentifier,
      externalEventId: event.externalEventId,
      dedupKey: event.dedupKey,
      title: event.title,
      summary: event.summary,
      eventUrl: event.eventUrl,
      occurredAt: event.occurredAt,
      payloadJson: event.payloadJson,
      createdAt: event.createdAt,
    });
  }

  async findByDedupKey(dedupKey: string): Promise<Event | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM events WHERE dedup_key = ?").get(dedupKey) as
      | EventRow
      | undefined;

    return row ? mapEventRow(row) : null;
  }
}
