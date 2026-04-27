import type { RiskLevel } from './common';

export interface CriticalCard {
  cardId: string;
  module: string;
  riskLevel: RiskLevel;
  score: number;
  detail: string;
}

export interface DashboardData {
  totalMonitoredCards: number;
  highRiskPercentage: number;
  activeAlerts: number;
  fraudTypeCount: number;
  riskDistribution: Array<{
    name: string;
    value: number;
  }>;
  alertVolumeByType: Array<{
    name: string;
    value: number;
  }>;
  criticalCards: CriticalCard[];
}
