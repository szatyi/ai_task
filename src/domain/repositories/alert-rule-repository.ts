export type AlertRuleSourceType = "rss" | "api";
export type AlertRuleStatus = "enabled" | "disabled";

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  sourceType: AlertRuleSourceType;
  sourceIdentifier: string;
  triggerCondition: string;
  status: AlertRuleStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleRepository {
  create(alertRule: AlertRule): Promise<void>;
  findById(alertRuleId: string): Promise<AlertRule | null>;
  list(): Promise<AlertRule[]>;
  updateStatus(alertRuleId: string, status: AlertRuleStatus, updatedAt: string): Promise<boolean>;
}
