import type { FraudType } from '@/types/fraud';

export type RiskCriticality = 'baixo' | 'medio' | 'alto' | 'critico';
export type CardOperationalStatus = 'ativo' | 'bloqueado';
export type CaseWorkflowStatus = 'monitoramento' | 'em_analise' | 'resolvido';
export type RiskActionType = 'monitoramento' | 'bloqueio' | 'alerta' | 'analise_humana' | 'resolvido' | 'reativacao';
export type NotificationChannel = 'whatsapp' | 'ligacao';

export interface RiskActionLog {
  id: string;
  type: RiskActionType;
  description: string;
  timestamp: string;
  automated: boolean;
  actor: string;
  channel?: NotificationChannel;
}

export interface RiskActionCase {
  id: string;
  cardId: string;
  score01: number;
  scorePercent: number;
  riskLevel: RiskCriticality;
  fraudTypes: FraudType[];
  fraudTypeLabels: string[];
  lastTransactionDateTime: string;
  lastTransactionLocation: string;
  cardStatus: CardOperationalStatus;
  caseStatus: CaseWorkflowStatus;
  recommendedAction: string;
  executedActionSummary: string;
  executedActionTypes: RiskActionType[];
  decisionJustification: string[];
  latestReason: string;
  transactionsCount: number;
  alertsCount: number;
  estimatedFinancialLoss: number;
  actionTimeline: RiskActionLog[];
}

export interface RiskActionOverride {
  cardStatus?: CardOperationalStatus;
  caseStatus?: CaseWorkflowStatus;
  extraLogs: RiskActionLog[];
}
