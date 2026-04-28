import type { FinancialEntry } from '@/types/financial';
import type { CopilotIntent } from '@/types/copilot';
import type { FraudType, UploadedDataset } from '@/types/fraud';
import type { RiskCriticality } from '@/types/riskActions';

export type AuditStatus = 'ok' | 'erro' | 'alerta' | 'regressao';
export type AuditImpact = 'baixo' | 'medio' | 'alto' | 'critico';
export type AuditSuite =
  | 'consistencia_dados'
  | 'graficos'
  | 'forecast'
  | 'antifraude'
  | 'acoes_automaticas'
  | 'copilot'
  | 'simulacao_usuario'
  | 'anomalias';

export interface ObservabilitySnapshot {
  dataset: UploadedDataset;
  financialEntries: FinancialEntry[];
}

export interface AuditBehaviorStep {
  id: string;
  label: string;
  status: AuditStatus;
  detail: string;
}

export interface AuditTestResult {
  id: string;
  suite: AuditSuite;
  name: string;
  status: AuditStatus;
  impact: AuditImpact;
  expected: string;
  actual: string;
  detail: string;
  recommendation: string;
  evidence: string[];
  timestamp: string;
}

export interface LearningInsight {
  signature: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  suggestedCause: string;
}

export interface AuditAnomaly {
  id: string;
  title: string;
  severity: AuditImpact;
  description: string;
}

export interface CopilotSimulationResult {
  id: string;
  scenario: string;
  intent: CopilotIntent;
  route: 'automatico' | 'coleta_dados' | 'humano';
  status: AuditStatus;
  detail: string;
}

export interface ActionAuditSummary {
  criticalCases: number;
  blockedCards: number;
  escalatedCases: number;
  topRiskLevel: RiskCriticality | 'baixo';
}

export interface AuditRunSummary {
  totalTests: number;
  ok: number;
  errors: number;
  alerts: number;
  regressions: number;
  accuracyPct: number;
}

export interface ObservabilityAuditRun {
  id: string;
  executedAt: string;
  summary: AuditRunSummary;
  sourceOverview: {
    transactionRows: number;
    alerts: number;
    cards: number;
    financialEntries: number;
  };
  tests: AuditTestResult[];
  anomalies: AuditAnomaly[];
  behaviorSteps: AuditBehaviorStep[];
  copilotSimulations: CopilotSimulationResult[];
  learningInsights: LearningInsight[];
  actionSummary: ActionAuditSummary;
  recurringFraudTypes: FraudType[];
}
