import type {
  Subscription,
  SubscriptionChannel,
  SubscriptionRepository,
} from "@/domain/repositories/subscription-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type SubscriptionRow = {
  id: string;
  user_id: string;
  alert_rule_id: string;
  channel: "email" | "slack";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
};

function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    alertRuleId: row.alert_rule_id,
    channel: row.channel,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at,
  };
}

export class SqliteSubscriptionRepository implements SubscriptionRepository {
  async create(subscription: Subscription): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO subscriptions (
        id, user_id, alert_rule_id, channel, status, created_at, updated_at, deactivated_at
      )
      VALUES (
        @id, @userId, @alertRuleId, @channel, @status, @createdAt, @updatedAt, @deactivatedAt
      )
      `,
    ).run({
      id: subscription.id,
      userId: subscription.userId,
      alertRuleId: subscription.alertRuleId,
      channel: subscription.channel,
      status: subscription.status,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      deactivatedAt: subscription.deactivatedAt,
    });
  }

  async findById(subscriptionId: string): Promise<Subscription | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId) as
      | SubscriptionRow
      | undefined;

    return row ? mapSubscriptionRow(row) : null;
  }

  async findByUserRuleAndChannel(
    userId: string,
    alertRuleId: string,
    channel: SubscriptionChannel,
  ): Promise<Subscription | null> {
    const db = getSqliteDatabase();
    const row = db
      .prepare(
        "SELECT * FROM subscriptions WHERE user_id = ? AND alert_rule_id = ? AND channel = ?",
      )
      .get(userId, alertRuleId, channel) as SubscriptionRow | undefined;

    return row ? mapSubscriptionRow(row) : null;
  }

  async listByUser(userId: string): Promise<Subscription[]> {
    const db = getSqliteDatabase();
    const rows = db
      .prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as SubscriptionRow[];

    return rows.map(mapSubscriptionRow);
  }

  async listByAlertRule(alertRuleId: string): Promise<Subscription[]> {
    const db = getSqliteDatabase();
    const rows = db
      .prepare("SELECT * FROM subscriptions WHERE alert_rule_id = ? ORDER BY created_at DESC")
      .all(alertRuleId) as SubscriptionRow[];

    return rows.map(mapSubscriptionRow);
  }

  async listActiveByAlertRule(alertRuleId: string): Promise<Subscription[]> {
    const db = getSqliteDatabase();
    const rows = db
      .prepare(
        "SELECT * FROM subscriptions WHERE alert_rule_id = ? AND status = 'active' ORDER BY created_at DESC",
      )
      .all(alertRuleId) as SubscriptionRow[];

    return rows.map(mapSubscriptionRow);
  }

  async countByStatus(status: "active" | "inactive"): Promise<number> {
    const db = getSqliteDatabase();
    const row = db
      .prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = ?")
      .get(status) as {
      count: number;
    };

    return row.count;
  }

  async deactivate(subscriptionId: string, deactivatedAt: string): Promise<boolean> {
    const db = getSqliteDatabase();
    const result = db
      .prepare(
        `
        UPDATE subscriptions
        SET status = 'inactive', deactivated_at = @deactivatedAt, updated_at = @deactivatedAt
        WHERE id = @subscriptionId AND status = 'active'
        `,
      )
      .run({ subscriptionId, deactivatedAt });

    return result.changes > 0;
  }

  async activate(subscriptionId: string, activatedAt: string): Promise<boolean> {
    const db = getSqliteDatabase();
    const result = db
      .prepare(
        `
        UPDATE subscriptions
        SET status = 'active', deactivated_at = NULL, updated_at = @activatedAt
        WHERE id = @subscriptionId AND status = 'inactive'
        `,
      )
      .run({ subscriptionId, activatedAt });

    return result.changes > 0;
  }
}
