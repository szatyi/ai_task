import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiIngestionService,
  ApiIngestionValidationError,
} from "@/application/services/api-ingestion-service";
import { EventIngestionService } from "@/application/services/event-ingestion-service";
import { POST as apiWebhookPost } from "@/app/api/ingestion/api-events/route";
import { startApiPollingJob } from "@/infrastructure/jobs/api-polling-job";
import { resetSqliteDatabaseSingleton } from "@/infrastructure/database/sqlite-client";
import { initializeDatabaseSchema } from "@/infrastructure/database/schema";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

describe("T-052 API ingestion path", () => {
  beforeEach(() => {
    resetSqliteDatabaseSingleton();
    process.env.SQLITE_DB_PATH = `data/test-t052-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
    initializeDatabaseSchema();
  });

  it("ingests webhook API payloads through the route handler", async () => {
    const response = await apiWebhookPost(
      new Request("http://localhost/api/ingestion/api-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceIdentifier: "provider-webhook",
          externalEventId: "wh-1",
          title: "Webhook event",
          summary: "webhook summary",
          eventUrl: "https://provider.example/events/wh-1",
          occurredAt: "2026-06-09T11:00:00Z",
          payload: { id: "wh-1" },
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: { status: string; dedupKey: string };
    };

    expect(body.result.status).toBe("ingested");
    expect(body.result.dedupKey).toBe("api:provider-webhook:wh-1");
  });

  it("validates webhook payloads and returns invalid request errors", async () => {
    const repository = new SqliteEventRepository();
    const service = new ApiIngestionService(new EventIngestionService(repository));

    await expect(
      service.ingestWebhookEvent({
        sourceIdentifier: "provider-webhook",
        title: "Missing external id",
        occurredAt: "2026-06-09T11:01:00Z",
      }),
    ).rejects.toBeInstanceOf(ApiIngestionValidationError);
  });

  it("deduplicates repeated webhook deliveries", async () => {
    const repository = new SqliteEventRepository();
    const service = new ApiIngestionService(new EventIngestionService(repository));

    const first = await service.ingestWebhookEvent({
      sourceIdentifier: "provider-repeat",
      externalEventId: "dup-1",
      title: "First",
      occurredAt: "2026-06-09T11:02:00Z",
      payload: { id: "dup-1" },
    });

    const second = await service.ingestWebhookEvent({
      sourceIdentifier: "provider-repeat",
      externalEventId: "dup-1",
      title: "Second",
      occurredAt: "2026-06-09T11:02:00Z",
      payload: { id: "dup-1" },
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
  });

  it("ingests polled API batches with cursor progression", async () => {
    vi.useFakeTimers();

    const pollFn = vi
      .fn<
        (cursor: string | null) => Promise<{
          events: Array<{
            sourceIdentifier: string;
            externalEventId: string;
            title: string;
            occurredAt: string;
          }>;
          nextCursor: string | null;
        }>
      >()
      .mockImplementationOnce(async () => ({
        events: [
          {
            sourceIdentifier: "provider-poll",
            externalEventId: "poll-1",
            title: "Poll item",
            occurredAt: "2026-06-09T11:05:00Z",
          },
        ],
        nextCursor: "cursor-1",
      }))
      .mockImplementationOnce(async () => ({
        events: [],
        nextCursor: "cursor-1",
      }));

    const handle = startApiPollingJob({
      intervalMs: 1000,
      pollFn,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    handle.stop();

    expect(pollFn).toHaveBeenNthCalledWith(1, null);
    expect(pollFn).toHaveBeenNthCalledWith(2, "cursor-1");

    vi.useRealTimers();
  });
});
