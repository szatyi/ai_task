import { EventIngestionService } from "@/application/services/event-ingestion-service";
import {
  RssIngestionService,
  type RssFeedSource,
} from "@/application/services/rss-ingestion-service";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

export type RssPollingJobHandle = {
  stop: () => void;
};

export function loadRssFeedSourcesFromEnv(): RssFeedSource[] {
  const raw = process.env.RSS_FEED_URLS ?? "";

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((url) => ({ url }));
}

export function startRssPollingJob(params: {
  intervalMs: number;
  feeds?: RssFeedSource[];
  fetchFn?: (input: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}): RssPollingJobHandle {
  const feeds = params.feeds ?? loadRssFeedSourcesFromEnv();

  if (feeds.length === 0) {
    return {
      stop: () => {
        return;
      },
    };
  }

  ensurePersistenceReady();

  const ingestion = new EventIngestionService(new SqliteEventRepository());
  const rssIngestion = new RssIngestionService(ingestion, params.fetchFn ?? fetch);

  const timer = setInterval(async () => {
    await rssIngestion.pollConfiguredFeeds(feeds);
  }, params.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
