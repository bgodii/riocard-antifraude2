export type FraudType =
  | 'compartilhamento'
  | 'revenda'
  | 'uso abusivo'
  | 'deslocamento impossivel'
  | 'multi validacao sequencial'
  | 'uso gratuidade indevida'
  | 'clonagem de cartao';

export type RiskScore = 'baixo' | 'medio' | 'alto';
export type AlertSource = 'modelo' | 'planilha' | 'hibrido';

export interface TransactionRecord {
  id: string;
  externalTransactionId: string;
  cardId: string;
  userId: string;
  userProfile: string;
  status: string;
  fareType: string;
  direction: string;
  dateTime: string;
  timestamp: number;
  amount: number | null;
  busLine: string;
  metroStation: string;
  transportType: string;
  equipmentLocation: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  timeSincePreviousMinutes: number | null;
  baseRiskScore: number | null;
  modelRiskScore: number | null;
  suspiciousFlag: boolean;
  suspiciousCategory: string;
  estimatedFinancialLoss: number | null;
  raw: Record<string, unknown>;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  relatedTransactionIds: string[];
  externalTransactionId: string;
  cardId: string;
  dateTime: string;
  timestamp: number;
  locationLabel: string;
  busLine: string;
  metroStation: string;
  transportType: string;
  fraudType: FraudType;
  riskScore: RiskScore;
  riskPoints: number;
  reason: string;
  source: AlertSource;
  sourceCategory: string;
  estimatedFinancialLoss: number | null;
}

export interface AnalysisStats {
  totalTransactions: number;
  averageDailyUsage: number;
  uniqueCards: number;
}

export interface UploadedDataset {
  rawRows: Record<string, unknown>[];
  transactions: TransactionRecord[];
  alerts: FraudAlert[];
  stats: AnalysisStats;
}

export interface FilterState {
  cardId: string;
  fraudType: string;
  station: string;
  line: string;
  startDate: string;
  endDate: string;
}

export interface FilterOptions {
  cardIds: string[];
  fraudTypes: FraudType[];
  stations: string[];
  lines: string[];
}

export interface SortState {
  column: 'cardId' | 'dateTime' | 'locationLabel' | 'fraudType' | 'riskScore';
  direction: 'asc' | 'desc';
}

export interface AnalyticsBundle {
  totalAlerts: number;
  highRiskAlerts: number;
  uniqueCards: number;
  suspiciousLocations: number;
  stationCoverage: number;
  lineCoverage: number;
  topFraudType: string;
  topCard: string;
  topStation: string;
  topLine: string;
  fraudByType: Array<{ name: string; total: number }>;
  fraudTimeline: Array<{ day: string; total: number }>;
  fraudByLocation: Array<{ name: string; total: number }>;
  keyAnswers: Array<{ label: string; value: string }>;
}

export interface SheetJsApi {
  read: (data: ArrayBuffer | string, options?: Record<string, unknown>) => SheetJsWorkbook;
  utils: {
    sheet_to_json: <T>(worksheet: unknown, options?: Record<string, unknown>) => T[];
  };
}

export interface SheetJsWorkbook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}
