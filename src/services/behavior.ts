import type { UserBehaviorProfile } from '@/types/behavior';

export const userBehaviorProfiles: UserBehaviorProfile[] = [
  {
    cardId: 'RIO-221903',
    deviationScore: 87,
    typicalHours: [
      { hour: '06h', count: 12 },
      { hour: '07h', count: 22 },
      { hour: '08h', count: 18 },
      { hour: '17h', count: 14 },
      { hour: '18h', count: 19 },
    ],
    frequentLocations: [
      { location: 'Central do Brasil', count: 34 },
      { location: 'Madureira', count: 21 },
      { location: 'Pavuna', count: 14 },
    ],
    heatmap: [
      { hour: '06h', location: 'Central', value: 6 },
      { hour: '07h', location: 'Central', value: 9 },
      { hour: '08h', location: 'Madureira', value: 7 },
      { hour: '17h', location: 'Central', value: 5 },
      { hour: '18h', location: 'Pavuna', value: 8 },
      { hour: '20h', location: 'Barra', value: 2 },
    ],
    comparison: [
      { label: 'Manha', normal: 28, atual: 41 },
      { label: 'Tarde', normal: 16, atual: 24 },
      { label: 'Noite', normal: 8, atual: 19 },
    ],
  },
  {
    cardId: 'RIO-903551',
    deviationScore: 74,
    typicalHours: [
      { hour: '07h', count: 11 },
      { hour: '08h', count: 19 },
      { hour: '12h', count: 6 },
      { hour: '18h', count: 15 },
      { hour: '19h', count: 11 },
    ],
    frequentLocations: [
      { location: 'Barra da Tijuca', count: 26 },
      { location: 'Meier', count: 17 },
      { location: 'Centro', count: 15 },
    ],
    heatmap: [
      { hour: '07h', location: 'Barra', value: 8 },
      { hour: '08h', location: 'Meier', value: 6 },
      { hour: '12h', location: 'Centro', value: 3 },
      { hour: '18h', location: 'Barra', value: 7 },
      { hour: '19h', location: 'Centro', value: 5 },
      { hour: '21h', location: 'Copacabana', value: 4 },
    ],
    comparison: [
      { label: 'Manha', normal: 24, atual: 29 },
      { label: 'Tarde', normal: 12, atual: 18 },
      { label: 'Noite', normal: 10, atual: 23 },
    ],
  },
  {
    cardId: 'RIO-665420',
    deviationScore: 69,
    typicalHours: [
      { hour: '05h', count: 8 },
      { hour: '06h', count: 16 },
      { hour: '07h', count: 14 },
      { hour: '17h', count: 9 },
      { hour: '18h', count: 12 },
    ],
    frequentLocations: [
      { location: 'Campo Grande', count: 31 },
      { location: 'Copacabana', count: 19 },
      { location: 'Carioca', count: 13 },
    ],
    heatmap: [
      { hour: '05h', location: 'Campo Grande', value: 5 },
      { hour: '06h', location: 'Campo Grande', value: 9 },
      { hour: '07h', location: 'Carioca', value: 6 },
      { hour: '18h', location: 'Copacabana', value: 8 },
      { hour: '19h', location: 'Copacabana', value: 4 },
      { hour: '21h', location: 'Centro', value: 3 },
    ],
    comparison: [
      { label: 'Manha', normal: 22, atual: 26 },
      { label: 'Tarde', normal: 8, atual: 12 },
      { label: 'Noite', normal: 6, atual: 17 },
    ],
  },
];
