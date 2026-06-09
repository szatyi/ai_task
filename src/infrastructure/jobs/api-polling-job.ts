import {
  ApiIngestionService,
  type ApiPollBatch,
} from "@/application/services/api-ingestion-service";
import { EventIngestionService } from "@/application/services/event-ingestion-service";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteEventRepository } from "@/infrastructure/repositories/sqlite-event-repository";

export type ApiPollingJobHandle = {
  stop: () => void;
};

export function startApiPollingJob(params: {
  intervalMs: number;
  pollFn: (cursor: string | null) => Promise<ApiPollBatch>;
}): ApiPollingJobHandle {
  ensurePersistenceReady();

  const ingestion = new ApiIngestionService(new EventIngestionService(new SqliteEventRepository()));
  let cursor: string | null = null;

  const timer = setInterval(async () => {
    const batch = await params.pollFn(cursor);
    const summary = await ingestion.ingestPolledBatch(batch);
    cursor = summary.nextCursor;
  }, params.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
