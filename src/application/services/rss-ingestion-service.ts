import { XMLParser } from "fast-xml-parser";
import type { EventIngestionService } from "@/application/services/event-ingestion-service";

export type RssFeedSource = {
  url: string;
};

export type RssPollSummary = {
  totalItems: number;
  createdItems: number;
  deduplicatedItems: number;
};

type FetchLike = (
  input: string,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

type ParsedRssItem = {
  guid?: string | { "#text"?: string };
  link?: string;
  title?: string;
  description?: string;
  pubDate?: string;
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractGuid(guid: ParsedRssItem["guid"]): string | null {
  if (!guid) {
    return null;
  }

  if (typeof guid === "string") {
    return guid;
  }

  return guid["#text"] ?? null;
}

export class RssIngestionService {
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly ingestionService: EventIngestionService,
    private readonly fetchFn: FetchLike,
  ) {}

  async pollConfiguredFeeds(feeds: RssFeedSource[]): Promise<RssPollSummary> {
    let totalItems = 0;
    let createdItems = 0;
    let deduplicatedItems = 0;

    for (const feed of feeds) {
      const response = await this.fetchFn(feed.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed ${feed.url}: ${response.status}`);
      }

      const xml = await response.text();
      const parsed = this.parser.parse(xml) as {
        rss?: { channel?: { item?: ParsedRssItem | ParsedRssItem[] } };
      };

      const items = toArray(parsed.rss?.channel?.item);

      for (const item of items) {
        totalItems += 1;

        const fallbackIdentity = `${item.link ?? "no-link"}:${item.title ?? "no-title"}`;
        const itemId = extractGuid(item.guid) ?? item.link ?? fallbackIdentity;

        const result = await this.ingestionService.ingestRssEvent({
          sourceIdentifier: feed.url,
          itemId,
          title: item.title ?? "Untitled RSS item",
          summary: item.description ?? null,
          eventUrl: item.link ?? null,
          occurredAt: item.pubDate
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString(),
          payload: item,
        });

        if (result.created) {
          createdItems += 1;
        } else {
          deduplicatedItems += 1;
        }
      }
    }

    return {
      totalItems,
      createdItems,
      deduplicatedItems,
    };
  }
}
