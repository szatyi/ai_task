import type {
  NotificationMessage,
  NotificationProvider,
  ProviderSendResult,
} from "@/application/ports/notification-provider";
import { ProviderAdapterError } from "@/infrastructure/providers/provider-adapter-error";

export type SlackTransportRequest = {
  channel?: string;
  text: string;
};

export type SlackTransport = {
  postMessage(request: SlackTransportRequest): Promise<{ ts: string }>;
};

export class SlackProviderAdapter implements NotificationProvider {
  constructor(private readonly transport: SlackTransport) {}

  async send(message: NotificationMessage): Promise<ProviderSendResult> {
    const text = `${message.subject}\n${message.body}`.trim();

    try {
      const response = await this.transport.postMessage({
        channel: message.target,
        text,
      });

      return {
        providerMessageId: response.ts,
      };
    } catch (error) {
      const mappedCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : null;

      throw new ProviderAdapterError(
        error instanceof Error ? error.message : "Slack provider error",
        "slack",
        mappedCode === "ratelimited" ? "transient" : "permanent",
        mappedCode,
      );
    }
  }
}
