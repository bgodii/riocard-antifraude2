import type { InformalSaleEvent } from '@/types/informalSales';

export const informalSalesEvents: InformalSaleEvent[] = [
  {
    id: 'VI-501',
    cardId: 'RIO-221903',
    transactionCount: 21,
    station: 'Central do Brasil',
    windowMinutes: 16,
    estimatedValue: 109.2,
    volumeSeries: [
      { time: '07:30', volume: 2 },
      { time: '07:35', volume: 4 },
      { time: '07:40', volume: 8 },
      { time: '07:45', volume: 5 },
      { time: '07:50', volume: 2 },
    ],
  },
  {
    id: 'VI-502',
    cardId: 'RIO-540771',
    transactionCount: 14,
    station: 'Pavuna',
    windowMinutes: 12,
    estimatedValue: 72.8,
    volumeSeries: [
      { time: '18:10', volume: 1 },
      { time: '18:15', volume: 3 },
      { time: '18:20', volume: 6 },
      { time: '18:25', volume: 3 },
      { time: '18:30', volume: 1 },
    ],
  },
  {
    id: 'VI-503',
    cardId: 'RIO-117990',
    transactionCount: 17,
    station: 'Madureira',
    windowMinutes: 18,
    estimatedValue: 88.4,
    volumeSeries: [
      { time: '12:05', volume: 2 },
      { time: '12:10', volume: 4 },
      { time: '12:15', volume: 7 },
      { time: '12:20', volume: 3 },
      { time: '12:25', volume: 1 },
    ],
  },
];
