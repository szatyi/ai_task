export type EventSourceType = "rss" | "api";

export interface Event {
  id: string;
  sourceType: EventSourceType;
  sourceIdentifier: string;
  externalEventId: string;
  dedupKey: string;
  title: string;
  summary: string | null;
  eventUrl: string | null;
  occurredAt: string;
  payloadJson: string;
  createdAt: string;
}

export interface EventRepository {
  create(event: Event): Promise<void>;
  findByDedupKey(dedupKey: string): Promise<Event | null>;
}
