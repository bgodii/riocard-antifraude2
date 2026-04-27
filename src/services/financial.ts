import type { FinancialSnapshot } from '@/types/financial';

export const financialSnapshots: FinancialSnapshot[] = [
  {
    period: 'dia',
    potentialLoss: 18750,
    recoveredValue: 7320,
    trend: [
      { period: '00h', revenue: 9200, fraudLoss: 260 },
      { period: '06h', revenue: 18400, fraudLoss: 950 },
      { period: '12h', revenue: 22600, fraudLoss: 1810 },
      { period: '18h', revenue: 24100, fraudLoss: 2240 },
      { period: '23h', revenue: 11800, fraudLoss: 690 },
    ],
    usageMix: [
      { category: 'Ônibus', value: 41200 },
      { category: 'BRT', value: 21600 },
      { category: 'Metrô', value: 18800 },
      { category: 'Trem', value: 12700 },
    ],
  },
  {
    period: 'semana',
    potentialLoss: 114600,
    recoveredValue: 48700,
    trend: [
      { period: 'Seg', revenue: 98200, fraudLoss: 8200 },
      { period: 'Ter', revenue: 101500, fraudLoss: 9100 },
      { period: 'Qua', revenue: 99500, fraudLoss: 8700 },
      { period: 'Qui', revenue: 108400, fraudLoss: 10400 },
      { period: 'Sex', revenue: 112100, fraudLoss: 11600 },
      { period: 'Sáb', revenue: 78400, fraudLoss: 6500 },
      { period: 'Dom', revenue: 65900, fraudLoss: 4900 },
    ],
    usageMix: [
      { category: 'Ônibus', value: 286000 },
      { category: 'BRT', value: 154000 },
      { category: 'Metrô', value: 127000 },
      { category: 'Trem', value: 98300 },
    ],
  },
  {
    period: 'mes',
    potentialLoss: 476300,
    recoveredValue: 195400,
    trend: [
      { period: 'Sem 1', revenue: 712000, fraudLoss: 62400 },
      { period: 'Sem 2', revenue: 736400, fraudLoss: 70100 },
      { period: 'Sem 3', revenue: 751800, fraudLoss: 73400 },
      { period: 'Sem 4', revenue: 769200, fraudLoss: 78200 },
    ],
    usageMix: [
      { category: 'Ônibus', value: 1186000 },
      { category: 'BRT', value: 603000 },
      { category: 'Metrô', value: 512000 },
      { category: 'Trem', value: 421000 },
    ],
  },
];
