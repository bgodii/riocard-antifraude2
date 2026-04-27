import type { FraudAlert, RiskScore, TransactionRecord, UploadedDataset } from '@/types/fraud';

export type CopilotChannel = 'web' | 'telegram';
export type CopilotRole = 'assistant' | 'user' | 'system';
export type CopilotTone = 'default' | 'success' | 'warning' | 'danger' | 'info';
export type CopilotIntent =
  | 'report_issue'
  | 'refund'
  | 'usage_history'
  | 'fraud_suspicion'
  | 'human_agent'
  | 'faq'
  | 'unknown';
export type CopilotDecision = 'resolve' | 'ask_info' | 'handoff';
export type CopilotAwaitingField =
  | 'full_name'
  | 'cpf'
  | 'address'
  | 'card_id'
  | 'refund_target'
  | 'transaction_confirmation'
  | null;
export type CardOperationalStatus = 'ativo' | 'atencao' | 'bloqueado';
export type FailureType = 'saldo_insuficiente' | 'erro_leitura' | 'bloqueio' | 'falha_operacional';
export type CopilotRoute = 'automatico' | 'coleta_dados' | 'humano';

export interface CustomerProfile {
  fullName: string | null;
  cpf: string | null;
  address: string | null;
}

export interface CopilotMessage {
  id: string;
  role: CopilotRole;
  content: string;
  tone: CopilotTone;
  timestamp: string;
  channel: CopilotChannel;
  suggestions?: string[];
}

export interface CardFailure {
  id: string;
  type: FailureType;
  dateTime: string;
  summary: string;
  eligibleForRefund: boolean;
  source: 'dataset' | 'mock';
}

export interface CardSummary {
  rawCardId: string;
  maskedCardId: string;
  status: CardOperationalStatus;
  statusReason: string;
  estimatedBalance: number;
  riskScore: RiskScore;
  alertCount: number;
  failureCount: number;
  lastValidation: string | null;
  lastLocation: string;
}

export interface CardLookupResult {
  cardId: string;
  summary: CardSummary;
  transactions: TransactionRecord[];
  alerts: FraudAlert[];
  failures: CardFailure[];
}

export interface CopilotSessionState {
  channel: CopilotChannel;
  customer: CustomerProfile;
  cardId: string | null;
  lookup: CardLookupResult | null;
  selectedTransactionId: string | null;
  awaitingField: CopilotAwaitingField;
  pendingIntent: CopilotIntent | null;
  handoffRecommended: boolean;
  lastIntent: CopilotIntent | null;
  lastRoute: CopilotRoute;
}

export interface CopilotTurnParams {
  channel: CopilotChannel;
  input: string;
  session: CopilotSessionState;
  dataset: UploadedDataset;
}

export interface CopilotTurnResult {
  session: CopilotSessionState;
  messages: CopilotMessage[];
}

export interface CopilotDecisionContext {
  intent: CopilotIntent;
  lookup: CardLookupResult;
  input: string;
  session: CopilotSessionState;
}
