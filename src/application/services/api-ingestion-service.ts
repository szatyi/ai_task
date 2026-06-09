import type {
  EventIngestionService,
  IngestEventResult,
} from "@/application/services/event-ingestion-service";

export type ApiIngestionPayload = {
  sourceIdentifier: string;
  externalEventId: string;
  title: string;
  summary?: string | null;
  eventUrl?: string | null;
  occurredAt: string;
  payload?: unknown;
};

export class ApiIngestionValidationError extends Error {}

export type ApiPollBatch = {
  events: ApiIngestionPayload[];
  nextCursor: string | null;
};

export type ApiPollSummary = {
  processedItems: number;
  createdItems: number;
  deduplicatedItems: number;
  nextCursor: string | null;
};

function validateApiPayload(
  payload: Partial<ApiIngestionPayload>,
): asserts payload is ApiIngestionPayload {
  if (
    !payload.sourceIdentifier ||
    !payload.externalEventId ||
    !payload.title ||
    !payload.occurredAt
  ) {
    throw new ApiIngestionValidationError(
      "sourceIdentifier, externalEventId, title, and occurredAt are required",
    );
  }
}

export class ApiIngestionService {
  constructor(private readonly ingestion: EventIngestionService) {}

  async ingestWebhookEvent(payload: Partial<ApiIngestionPayload>): Promise<IngestEventResult> {
    validateApiPayload(payload);

    return this.ingestion.ingestApiEvent({
      sourceIdentifier: payload.sourceIdentifier,
      externalEventId: payload.externalEventId,
      title: payload.title,
      summary: payload.summary ?? null,
      eventUrl: payload.eventUrl ?? null,
      occurredAt: payload.occurredAt,
      payload: payload.payload ?? payload,
    });
  }

  async ingestPolledBatch(batch: ApiPollBatch): Promise<ApiPollSummary> {
    let createdItems = 0;
    let deduplicatedItems = 0;

    for (const item of batch.events) {
      const result = await this.ingestWebhookEvent(item);

      if (result.created) {
        createdItems += 1;
      } else {
        deduplicatedItems += 1;
      }
    }

    return {
      processedItems: batch.events.length,
      createdItems,
      deduplicatedItems,
      nextCursor: batch.nextCursor,
    };
  }
}
