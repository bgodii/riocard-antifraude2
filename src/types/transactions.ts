import type { RiskLevel } from './common';

export interface SuspiciousTransaction {
  id: string;
  cardId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  fraudType: string;
  amount: number;
  location: string;
  dateTime: string;
}
