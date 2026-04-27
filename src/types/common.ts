export type RiskLevel = 'baixo' | 'medio' | 'alto';

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface ComparisonPoint {
  label: string;
  normal: number;
  atual: number;
}

export interface ModuleSummary {
  title: string;
  count: number;
  tone: 'success' | 'warning' | 'danger';
}
