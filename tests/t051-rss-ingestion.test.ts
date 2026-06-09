import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventIngestionService } from "@/application/services/event-ingestion-service";
import { RssIngestionService } from "@/application/services/rss-ingestion-service";
import { startRssPollingJob } from "@/infrastructure/jobs/rss-polling-job";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

const RSS_XML = `
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <guid>item-1</guid>
      <title>Item 1</title>
      <description>Summary 1</description>
      <link>https://example.com/item-1</link>
      <pubDate>Tue, 09 Jun 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <guid>item-2</guid>
      <title>Item 2</title>
      <description>Summary 2</description>
      <link>https://example.com/item-2</link>
      <pubDate>Tue, 09 Jun 2026 10:05:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`;

describe("T-051 RSS ingestion", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t051-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();
  });

  it("polls RSS feeds and stores normalized feed items", async () => {
    const repository = new SqliteEventRepository();
    const ingestion = new EventIngestionService(repository);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => RSS_XML,
    }));

    const service = new RssIngestionService(ingestion, fetchMock);
    const result = await service.pollConfiguredFeeds([{ url: "https://example.com/feed.xml" }]);

    expect(result.totalItems).toBe(2);
    expect(result.createdItems).toBe(2);
    expect(result.deduplicatedItems).toBe(0);

    const itemOne = await repository.findByDedupKey("rss:https://example.com/feed.xml:item-1");
    expect(itemOne?.title).toBe("Item 1");
    expect(itemOne?.summary).toBe("Summary 1");
  });

  it("deduplicates repeated feed polling", async () => {
    const repository = new SqliteEventRepository();
    const ingestion = new EventIngestionService(repository);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => RSS_XML,
    }));

    const service = new RssIngestionService(ingestion, fetchMock);

    const firstPoll = await service.pollConfiguredFeeds([{ url: "https://example.com/feed.xml" }]);
    const secondPoll = await service.pollConfiguredFeeds([{ url: "https://example.com/feed.xml" }]);

    expect(firstPoll.createdItems).toBe(2);
    expect(secondPoll.createdItems).toBe(0);
    expect(secondPoll.deduplicatedItems).toBe(2);
  });

  it("provides a scheduled polling entry point", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => RSS_XML,
    }));

    const handle = startRssPollingJob({
      intervalMs: 1000,
      feeds: [{ url: "https://example.com/feed.xml" }],
      fetchFn: fetchMock,
    });

    await vi.advanceTimersByTimeAsync(1000);
    handle.stop();

    expect(fetchMock).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
