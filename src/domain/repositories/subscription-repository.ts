export type SubscriptionChannel = "email" | "slack";
export type SubscriptionStatus = "active" | "inactive";

export interface Subscription {
  id: string;
  userId: string;
  alertRuleId: string;
  channel: SubscriptionChannel;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface SubscriptionRepository {
  create(subscription: Subscription): Promise<void>;
  findById(subscriptionId: string): Promise<Subscription | null>;
  findByUserRuleAndChannel(
    userId: string,
    alertRuleId: string,
    channel: SubscriptionChannel,
  ): Promise<Subscription | null>;
  listByUser(userId: string): Promise<Subscription[]>;
  deactivate(subscriptionId: string, deactivatedAt: string): Promise<boolean>;
  activate(subscriptionId: string, activatedAt: string): Promise<boolean>;
}
