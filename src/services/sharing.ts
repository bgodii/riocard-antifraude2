import type { CardSharingEvent } from '@/types/sharing';

export const cardSharingEvents: CardSharingEvent[] = [
  {
    id: 'CP-301',
    cardId: 'RIO-903551',
    estimatedUsers: 3,
    intervalMinutes: 5,
    simultaneousLocations: ['Barra da Tijuca', 'Méier'],
    timeline: [
      { time: '07:02', location: 'Barra da Tijuca', action: 'Validacao' },
      { time: '07:07', location: 'Méier', action: 'Validacao' },
      { time: '07:15', location: 'Del Castilho', action: 'Integracao' },
      { time: '07:26', location: 'Centro', action: 'Saida' },
    ],
  },
  {
    id: 'CP-302',
    cardId: 'RIO-665420',
    estimatedUsers: 2,
    intervalMinutes: 3,
    simultaneousLocations: ['Campo Grande', 'Copacabana'],
    timeline: [
      { time: '18:21', location: 'Campo Grande', action: 'Validacao' },
      { time: '18:24', location: 'Copacabana', action: 'Validacao' },
      { time: '18:39', location: 'Siqueira Campos', action: 'Saida' },
    ],
  },
  {
    id: 'CP-303',
    cardId: 'RIO-112084',
    estimatedUsers: 4,
    intervalMinutes: 8,
    simultaneousLocations: ['Nova Iguaçu', 'São Cristóvão'],
    timeline: [
      { time: '06:48', location: 'Nova Iguaçu', action: 'Validacao' },
      { time: '06:55', location: 'São Cristóvão', action: 'Validacao' },
      { time: '07:03', location: 'Maracanã', action: 'Integracao' },
      { time: '07:17', location: 'Central', action: 'Saida' },
    ],
  },
];
