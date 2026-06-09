import type {
  AlertRule,
  AlertRuleRepository,
  AlertRuleStatus,
} from "@/domain/repositories/alert-rule-repository";
import { getSqliteDatabase } from "@/infrastructure/database/sqlite-client";

type AlertRuleRow = {
  id: string;
  name: string;
  description: string | null;
  source_type: "rss" | "api";
  source_identifier: string;
  trigger_condition: string;
  status: "enabled" | "disabled";
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

function mapAlertRuleRow(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type,
    sourceIdentifier: row.source_identifier,
    triggerCondition: row.trigger_condition,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteAlertRuleRepository implements AlertRuleRepository {
  async create(alertRule: AlertRule): Promise<void> {
    const db = getSqliteDatabase();

    db.prepare(
      `
      INSERT INTO alert_rules (
        id, name, description, source_type, source_identifier, trigger_condition,
        status, created_by_user_id, created_at, updated_at
      )
      VALUES (
        @id, @name, @description, @sourceType, @sourceIdentifier, @triggerCondition,
        @status, @createdByUserId, @createdAt, @updatedAt
      )
      `,
    ).run({
      id: alertRule.id,
      name: alertRule.name,
      description: alertRule.description,
      sourceType: alertRule.sourceType,
      sourceIdentifier: alertRule.sourceIdentifier,
      triggerCondition: alertRule.triggerCondition,
      status: alertRule.status,
      createdByUserId: alertRule.createdByUserId,
      createdAt: alertRule.createdAt,
      updatedAt: alertRule.updatedAt,
    });
  }

  async findById(alertRuleId: string): Promise<AlertRule | null> {
    const db = getSqliteDatabase();
    const row = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(alertRuleId) as
      | AlertRuleRow
      | undefined;

    return row ? mapAlertRuleRow(row) : null;
  }

  async list(): Promise<AlertRule[]> {
    const db = getSqliteDatabase();
    const rows = db
      .prepare("SELECT * FROM alert_rules ORDER BY created_at DESC")
      .all() as AlertRuleRow[];

    return rows.map(mapAlertRuleRow);
  }

  async updateStatus(
    alertRuleId: string,
    status: AlertRuleStatus,
    updatedAt: string,
  ): Promise<boolean> {
    const db = getSqliteDatabase();
    const result = db
      .prepare(
        `
        UPDATE alert_rules
        SET status = @status, updated_at = @updatedAt
        WHERE id = @alertRuleId
        `,
      )
      .run({ alertRuleId, status, updatedAt });

    return result.changes > 0;
  }
}
