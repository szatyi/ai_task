import type {
  NotificationMessage,
  NotificationProvider,
  ProviderSendResult,
} from "@/application/ports/notification-provider";
import { ProviderAdapterError } from "@/infrastructure/providers/provider-adapter-error";

export type EmailTransportRequest = {
  to?: string;
  subject: string;
  text: string;
};

export type EmailTransport = {
  sendEmail(request: EmailTransportRequest): Promise<{ messageId: string }>;
};

export class EmailProviderAdapter implements NotificationProvider {
  constructor(private readonly transport: EmailTransport) {}

  async send(message: NotificationMessage): Promise<ProviderSendResult> {
    try {
      const response = await this.transport.sendEmail({
        to: message.target,
        subject: message.subject,
        text: message.body,
      });

      return {
        providerMessageId: response.messageId,
      };
    } catch (error) {
      const mappedCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : null;

      throw new ProviderAdapterError(
        error instanceof Error ? error.message : "Email provider error",
        "email",
        mappedCode === "ETIMEDOUT" ? "transient" : "permanent",
        mappedCode,
      );
    }
  }
}
