import type { TicketingFraudEvent } from '@/types/ticketing';

export const ticketingFrauds: TicketingFraudEvent[] = [
  {
    id: 'BT-101',
    cardId: 'RIO-221903',
    fraudType: 'Revalidacao sequencial',
    categories: ['Revalidacao sequencial'],
    anomalousFrequency: 4.9,
    occurrences: 17,
    usageSeries: [
      { time: '06h', uses: 2 },
      { time: '07h', uses: 3 },
      { time: '08h', uses: 10 },
      { time: '09h', uses: 14 },
      { time: '10h', uses: 6 },
    ],
  },
  {
    id: 'BT-102',
    cardId: 'RIO-784112',
    fraudType: 'Repeticao em bloqueio curto',
    categories: ['Repeticao em bloqueio curto'],
    anomalousFrequency: 4.4,
    occurrences: 12,
    usageSeries: [
      { time: '06h', uses: 1 },
      { time: '07h', uses: 2 },
      { time: '08h', uses: 9 },
      { time: '09h', uses: 11 },
      { time: '10h', uses: 4 },
    ],
  },
  {
    id: 'BT-103',
    cardId: 'RIO-450003',
    fraudType: 'Multipla integracao incomum',
    categories: ['Multipla integracao incomum'],
    anomalousFrequency: 3.8,
    occurrences: 9,
    usageSeries: [
      { time: '11h', uses: 1 },
      { time: '12h', uses: 4 },
      { time: '13h', uses: 8 },
      { time: '14h', uses: 7 },
      { time: '15h', uses: 3 },
    ],
  },
];
