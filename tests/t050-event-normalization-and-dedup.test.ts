import { beforeEach, describe, expect, it } from "vitest";
import { EventIngestionService } from "@/application/services/event-ingestion-service";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

describe("T-050 event normalization and deduplication", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t050-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();
  });

  it("normalizes RSS inbound input into the internal event shape", async () => {
    const repository = new SqliteEventRepository();
    const service = new EventIngestionService(repository);

    const result = await service.ingestRssEvent({
      sourceIdentifier: "https://example.com/feed.xml",
      itemId: "rss-item-1",
      title: "RSS Title",
      summary: "RSS Summary",
      eventUrl: "https://example.com/posts/1",
      occurredAt: "2026-06-09T10:00:00Z",
      payload: { guid: "rss-item-1" },
    });

    expect(result.created).toBe(true);
    expect(result.event.sourceType).toBe("rss");
    expect(result.event.externalEventId).toBe("rss-item-1");
    expect(result.event.occurredAt).toBe("2026-06-09T10:00:00Z");
    expect(result.event.summary).toBe("RSS Summary");
    expect(result.event.dedupKey).toBe("rss:https://example.com/feed.xml:rss-item-1");
  });

  it("normalizes API inbound input into the internal event shape", async () => {
    const repository = new SqliteEventRepository();
    const service = new EventIngestionService(repository);

    const result = await service.ingestApiEvent({
      sourceIdentifier: "provider-1",
      externalEventId: "api-event-99",
      title: "API Title",
      summary: "API Summary",
      eventUrl: "https://provider.example/events/99",
      occurredAt: "2026-06-09T10:05:00Z",
      payload: { id: "api-event-99" },
    });

    expect(result.created).toBe(true);
    expect(result.event.sourceType).toBe("api");
    expect(result.event.externalEventId).toBe("api-event-99");
    expect(result.event.dedupKey).toBe("api:provider-1:api-event-99");
  });

  it("deduplicates repeated inbound items using database uniqueness", async () => {
    const repository = new SqliteEventRepository();
    const service = new EventIngestionService(repository);

    const first = await service.ingestApiEvent({
      sourceIdentifier: "provider-2",
      externalEventId: "evt-1",
      title: "Initial title",
      summary: "first",
      eventUrl: null,
      occurredAt: "2026-06-09T10:10:00Z",
      payload: { id: "evt-1" },
    });

    const second = await service.ingestApiEvent({
      sourceIdentifier: "provider-2",
      externalEventId: "evt-1",
      title: "Updated title should not duplicate",
      summary: "second",
      eventUrl: null,
      occurredAt: "2026-06-09T10:10:00Z",
      payload: { id: "evt-1", duplicate: true },
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);

    const stored = await repository.findByDedupKey("api:provider-2:evt-1");
    expect(stored?.id).toBe(first.event.id);
  });
});
