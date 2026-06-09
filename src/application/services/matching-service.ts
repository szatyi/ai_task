import type { AlertRuleRepository } from "@/domain/repositories/alert-rule-repository";
import type { Event } from "@/domain/repositories/event-repository";
import type { SubscriptionRepository } from "@/domain/repositories/subscription-repository";

export type DeliveryCandidate = {
  eventId: string;
  alertRuleId: string;
  subscriptionId: string;
  channel: "email" | "slack";
};

function evaluateTriggerCondition(event: Event, triggerCondition: string): boolean {
  const normalizedCondition = triggerCondition.trim();
  const searchableText = `${event.title} ${event.summary ?? ""}`.toLowerCase();

  if (normalizedCondition.startsWith("contains:")) {
    const keyword = normalizedCondition.slice("contains:".length).trim().toLowerCase();
    return keyword.length > 0 && searchableText.includes(keyword);
  }

  return searchableText.includes(normalizedCondition.toLowerCase());
}

export class MatchingService {
  constructor(
    private readonly alertRules: AlertRuleRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async evaluateEvent(event: Event): Promise<DeliveryCandidate[]> {
    const rules = await this.alertRules.list();

    const matchingRules = rules
      .filter((rule) => rule.status === "enabled")
      .filter((rule) => rule.sourceType === event.sourceType)
      .filter((rule) => rule.sourceIdentifier === event.sourceIdentifier)
      .filter((rule) => evaluateTriggerCondition(event, rule.triggerCondition));

    const candidates: DeliveryCandidate[] = [];

    for (const rule of matchingRules) {
      const activeSubscriptions = await this.subscriptions.listActiveByAlertRule(rule.id);

      for (const subscription of activeSubscriptions) {
        candidates.push({
          eventId: event.id,
          alertRuleId: rule.id,
          subscriptionId: subscription.id,
          channel: subscription.channel,
        });
      }
    }

    return candidates;
  }
}
