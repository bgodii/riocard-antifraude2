export interface TicketingFraudEvent {
  id: string;
  cardId: string;
  fraudType: string;
  categories?: string[];
  anomalousFrequency: number;
  occurrences: number;
  usageSeries: Array<{
    time: string;
    uses: number;
  }>;
}
