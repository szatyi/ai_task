import { beforeEach, describe, expect, it } from "vitest";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

describe("T-013 event storage", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t013-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();
  });

  it("stores normalized event fields for matching and traceability", async () => {
    const events = new SqliteEventRepository();

    await events.create({
      id: "evt_1",
      sourceType: "rss",
      sourceIdentifier: "https://example.com/feed.xml",
      externalEventId: "feed-item-1",
      dedupKey: "rss:https://example.com/feed.xml:feed-item-1",
      title: "Breaking Event",
      summary: "Event summary",
      eventUrl: "https://example.com/article/1",
      occurredAt: "2026-06-09T00:00:00Z",
      payloadJson: JSON.stringify({ key: "value" }),
      createdAt: "2026-06-09T00:00:01Z",
    });

    const stored = await events.findByDedupKey("rss:https://example.com/feed.xml:feed-item-1");

    expect(stored?.sourceType).toBe("rss");
    expect(stored?.externalEventId).toBe("feed-item-1");
    expect(stored?.title).toBe("Breaking Event");
    expect(stored?.payloadJson).toBe(JSON.stringify({ key: "value" }));
  });

  it("enforces deduplication by unique dedup key", async () => {
    const events = new SqliteEventRepository();

    await events.create({
      id: "evt_2",
      sourceType: "api",
      sourceIdentifier: "provider-1",
      externalEventId: "external-1",
      dedupKey: "api:provider-1:external-1",
      title: "API Event",
      summary: null,
      eventUrl: null,
      occurredAt: "2026-06-09T00:00:00Z",
      payloadJson: JSON.stringify({ event: 1 }),
      createdAt: "2026-06-09T00:00:01Z",
    });

    await expect(
      events.create({
        id: "evt_3",
        sourceType: "api",
        sourceIdentifier: "provider-1",
        externalEventId: "external-1",
        dedupKey: "api:provider-1:external-1",
        title: "Duplicate",
        summary: null,
        eventUrl: null,
        occurredAt: "2026-06-09T00:00:00Z",
        payloadJson: JSON.stringify({ event: 2 }),
        createdAt: "2026-06-09T00:00:01Z",
      }),
    ).rejects.toThrow();
  });
});
