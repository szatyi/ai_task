import { describe, expect, it, vi } from "vitest";
import { EmailProviderAdapter } from "@/infrastructure/providers/email-provider-adapter";
import { ProviderAdapterError } from "@/infrastructure/providers/provider-adapter-error";

describe("T-071 email provider adapter", () => {
  it("sends notifications through the email adapter contract", async () => {
    const sendEmail = vi.fn(async () => ({ messageId: "email-msg-1" }));
    const adapter = new EmailProviderAdapter({ sendEmail });

    const result = await adapter.send({
      subject: "Alert",
      body: "Message body",
      target: "user@example.com",
    });

    expect(result.providerMessageId).toBe("email-msg-1");
    expect(sendEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Alert",
      text: "Message body",
    });
  });

  it("maps provider failures into normalized adapter errors", async () => {
    const sendEmail = vi.fn(async () => {
      const error = new Error("SMTP timeout") as Error & { code?: string };
      error.code = "ETIMEDOUT";
      throw error;
    });

    const adapter = new EmailProviderAdapter({ sendEmail });

    await expect(
      adapter.send({
        subject: "Alert",
        body: "Message body",
      }),
    ).rejects.toMatchObject<Partial<ProviderAdapterError>>({
      message: "SMTP timeout",
      providerName: "email",
      category: "transient",
      providerCode: "ETIMEDOUT",
    });
  });
});
