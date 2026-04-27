export interface InformalSaleEvent {
  id: string;
  cardId: string;
  transactionCount: number;
  station: string;
  windowMinutes: number;
  estimatedValue: number;
  volumeSeries: Array<{
    time: string;
    volume: number;
  }>;
}
