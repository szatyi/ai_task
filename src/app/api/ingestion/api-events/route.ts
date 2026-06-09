import { NextResponse } from "next/server";
import {
  ApiIngestionService,
  ApiIngestionValidationError,
} from "@/application/services/api-ingestion-service";
import { EventIngestionService } from "@/application/services/event-ingestion-service";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as {
    sourceIdentifier?: string;
    externalEventId?: string;
    title?: string;
    summary?: string | null;
    eventUrl?: string | null;
    occurredAt?: string;
    payload?: unknown;
  };

  try {
    ensurePersistenceReady();

    const ingestion = new ApiIngestionService(
      new EventIngestionService(new SqliteEventRepository()),
    );
    const result = await ingestion.ingestWebhookEvent(payload);

    return NextResponse.json({
      result: {
        status: result.created ? "ingested" : "duplicate",
        eventId: result.event.id,
        dedupKey: result.event.dedupKey,
      },
    });
  } catch (error) {
    if (error instanceof ApiIngestionValidationError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: error.message } },
        { status: 400 },
      );
    }

    throw error;
  }
}
