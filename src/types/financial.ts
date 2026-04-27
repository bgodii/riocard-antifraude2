export type PeriodFilter = 'dia' | 'semana' | 'mes';

export interface FinancialTrendPoint {
  period: string;
  revenue: number;
  fraudLoss: number;
}

export interface UsageRevenuePoint {
  category: string;
  value: number;
}

export interface FinancialSnapshot {
  period: PeriodFilter;
  trend: FinancialTrendPoint[];
  usageMix: UsageRevenuePoint[];
  potentialLoss: number;
  recoveredValue: number;
}
