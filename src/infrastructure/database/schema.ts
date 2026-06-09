import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

export function initializeDatabaseSchema(): void {
  const db = getSqliteDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      role TEXT NOT NULL CHECK(role IN ('user', 'operator')),
      status TEXT NOT NULL CHECK(status IN ('active', 'disabled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('active', 'invalidated')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      invalidated_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('rss', 'api')),
      source_identifier TEXT NOT NULL,
      trigger_condition TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('enabled', 'disabled')),
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_alert_rules_status ON alert_rules(status);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_source_type ON alert_rules(source_type);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_source_identifier ON alert_rules(source_identifier);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_rule_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('email', 'slack')),
      status TEXT NOT NULL CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deactivated_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(alert_rule_id) REFERENCES alert_rules(id),
      UNIQUE(user_id, alert_rule_id, channel)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_alert_rule_id ON subscriptions(alert_rule_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL CHECK(source_type IN ('rss', 'api')),
      source_identifier TEXT NOT NULL,
      external_event_id TEXT NOT NULL,
      dedup_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT,
      event_url TEXT,
      occurred_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_source_type ON events(source_type);
    CREATE INDEX IF NOT EXISTS idx_events_source_identifier ON events(source_identifier);
    CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_events_dedup_key ON events(dedup_key);

    CREATE TABLE IF NOT EXISTS failure_records (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL UNIQUE,
      failure_type TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_code TEXT,
      failure_payload_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_failure_records_delivery_id ON failure_records(delivery_id);
    CREATE INDEX IF NOT EXISTS idx_failure_records_created_at ON failure_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_failure_records_provider_name ON failure_records(provider_name);

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('email', 'slack')),
      status TEXT NOT NULL CHECK(status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
      attempt_count INTEGER NOT NULL,
      provider_message_id TEXT,
      failure_record_id TEXT,
      queued_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(event_id) REFERENCES events(id),
      FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
      FOREIGN KEY(failure_record_id) REFERENCES failure_records(id),
      UNIQUE(event_id, subscription_id, channel)
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_event_id ON deliveries(event_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_subscription_id ON deliveries(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_channel ON deliveries(channel);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_queued_at ON deliveries(queued_at);
  `);
}
