import { randomUUID } from "node:crypto";
import type { Event, EventRepository } from "@/domain/repositories/event-repository";

type RssInboundEvent = {
  sourceIdentifier: string;
  itemId: string;
  title: string;
  summary?: string | null;
  eventUrl?: string | null;
  occurredAt: string;
  payload?: unknown;
};

type ApiInboundEvent = {
  sourceIdentifier: string;
  externalEventId: string;
  title: string;
  summary?: string | null;
  eventUrl?: string | null;
  occurredAt: string;
  payload?: unknown;
};

type NormalizedEventInput = {
  sourceType: "rss" | "api";
  sourceIdentifier: string;
  externalEventId: string;
  title: string;
  summary: string | null;
  eventUrl: string | null;
  occurredAt: string;
  payloadJson: string;
};

export type IngestEventResult = {
  event: Event;
  created: boolean;
};

function buildDedupKey(input: {
  sourceType: "rss" | "api";
  sourceIdentifier: string;
  externalEventId: string;
}): string {
  return `${input.sourceType}:${input.sourceIdentifier}:${input.externalEventId}`;
}

function serializePayload(payload: unknown, fallback: object): string {
  if (payload === undefined) {
    return JSON.stringify(fallback);
  }

  return JSON.stringify(payload);
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("UNIQUE constraint failed") ||
    error.message.includes("SQLITE_CONSTRAINT")
  );
}

export class EventIngestionService {
  constructor(private readonly events: EventRepository) {}

  async ingestRssEvent(input: RssInboundEvent): Promise<IngestEventResult> {
    return this.ingestNormalizedEvent({
      sourceType: "rss",
      sourceIdentifier: input.sourceIdentifier,
      externalEventId: input.itemId,
      title: input.title,
      summary: input.summary ?? null,
      eventUrl: input.eventUrl ?? null,
      occurredAt: input.occurredAt,
      payloadJson: serializePayload(input.payload, {
        sourceType: "rss",
        sourceIdentifier: input.sourceIdentifier,
        itemId: input.itemId,
      }),
    });
  }

  async ingestApiEvent(input: ApiInboundEvent): Promise<IngestEventResult> {
    return this.ingestNormalizedEvent({
      sourceType: "api",
      sourceIdentifier: input.sourceIdentifier,
      externalEventId: input.externalEventId,
      title: input.title,
      summary: input.summary ?? null,
      eventUrl: input.eventUrl ?? null,
      occurredAt: input.occurredAt,
      payloadJson: serializePayload(input.payload, {
        sourceType: "api",
        sourceIdentifier: input.sourceIdentifier,
        externalEventId: input.externalEventId,
      }),
    });
  }

  private async ingestNormalizedEvent(input: NormalizedEventInput): Promise<IngestEventResult> {
    const dedupKey = buildDedupKey(input);
    const now = new Date().toISOString();
    const event: Event = {
      id: `evt_${randomUUID()}`,
      sourceType: input.sourceType,
      sourceIdentifier: input.sourceIdentifier,
      externalEventId: input.externalEventId,
      dedupKey,
      title: input.title,
      summary: input.summary,
      eventUrl: input.eventUrl,
      occurredAt: input.occurredAt,
      payloadJson: input.payloadJson,
      createdAt: now,
    };

    try {
      await this.events.create(event);
      return { event, created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.events.findByDedupKey(dedupKey);

      if (!existing) {
        throw error;
      }

      return { event: existing, created: false };
    }
  }
}
