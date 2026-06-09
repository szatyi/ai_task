import { randomUUID } from "node:crypto";
import type {
  NotificationProvider,
  NotificationProviderMap,
} from "@/application/ports/notification-provider";
import { EmailProviderAdapter } from "@/infrastructure/providers/email-provider-adapter";
import { SlackProviderAdapter } from "@/infrastructure/providers/slack-provider-adapter";

export class ChannelNotConfiguredError extends Error {}

function buildEmailProvider(): NotificationProvider | null {
  const mode = process.env.EMAIL_PROVIDER_MODE ?? "disabled";

  if (mode !== "mock") {
    return null;
  }

  return new EmailProviderAdapter({
    sendEmail: async () => ({
      messageId: `email_${randomUUID()}`,
    }),
  });
}

function buildSlackProvider(): NotificationProvider | null {
  const mode = process.env.SLACK_PROVIDER_MODE ?? "disabled";

  if (mode !== "mock") {
    return null;
  }

  return new SlackProviderAdapter({
    postMessage: async () => ({
      ts: `slack_${randomUUID()}`,
    }),
  });
}

export function buildConfiguredProviders(): NotificationProviderMap {
  return {
    email: buildEmailProvider() ?? undefined,
    slack: buildSlackProvider() ?? undefined,
  };
}

export function getConfiguredProvider(channel: "email" | "slack"): NotificationProvider {
  const providers = buildConfiguredProviders();
  const provider = providers[channel];

  if (!provider) {
    throw new ChannelNotConfiguredError(`${channel} channel is not configured`);
  }

  return provider;
}
