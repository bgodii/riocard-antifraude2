import type { ComparisonPoint } from './common';

export interface HeatmapCell {
  hour: string;
  location: string;
  value: number;
}

export interface FrequentLocation {
  location: string;
  count: number;
}

export interface UserBehaviorProfile {
  cardId: string;
  typicalHours: Array<{
    hour: string;
    count: number;
  }>;
  frequentLocations: FrequentLocation[];
  heatmap: HeatmapCell[];
  comparison: ComparisonPoint[];
  monthlyTrend?: Array<{
    label: string;
    total: number;
  }>;
  deviationScore: number;
}
