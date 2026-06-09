import { describe, expect, it, vi } from "vitest";
import { ProviderAdapterError } from "@/infrastructure/providers/provider-adapter-error";
import { SlackProviderAdapter } from "@/infrastructure/providers/slack-provider-adapter";

describe("T-072 slack provider adapter", () => {
  it("sends notifications through the slack adapter contract", async () => {
    const postMessage = vi.fn(async () => ({ ts: "1717939200.000100" }));
    const adapter = new SlackProviderAdapter({ postMessage });

    const result = await adapter.send({
      subject: "Alert",
      body: "Message body",
      target: "#alerts",
    });

    expect(result.providerMessageId).toBe("1717939200.000100");
    expect(postMessage).toHaveBeenCalledWith({
      channel: "#alerts",
      text: "Alert\nMessage body",
    });
  });

  it("maps provider failures into normalized adapter errors", async () => {
    const postMessage = vi.fn(async () => {
      const error = new Error("Too many requests") as Error & { code?: string };
      error.code = "ratelimited";
      throw error;
    });

    const adapter = new SlackProviderAdapter({ postMessage });

    await expect(
      adapter.send({
        subject: "Alert",
        body: "Message body",
      }),
    ).rejects.toMatchObject<Partial<ProviderAdapterError>>({
      message: "Too many requests",
      providerName: "slack",
      category: "transient",
      providerCode: "ratelimited",
    });
  });
});
