import type { DashboardData } from '@/types/dashboard';
import { suspiciousTransactions } from './transactions';
import { ticketingFrauds } from './ticketing';
import { cardSharingEvents } from './sharing';
import { informalSalesEvents } from './informalSales';
import { userBehaviorProfiles } from './behavior';

export const dashboardData: DashboardData = {
  totalMonitoredCards: 128450,
  highRiskPercentage: 14.7,
  activeAlerts: suspiciousTransactions.length + ticketingFrauds.length + cardSharingEvents.length + informalSalesEvents.length,
  fraudTypeCount: 5,
  riskDistribution: [
    { name: 'Alto risco', value: 18 },
    { name: 'Médio risco', value: 33 },
    { name: 'Baixo risco', value: 49 },
  ],
  alertVolumeByType: [
    { name: 'Score de risco', value: suspiciousTransactions.length },
    { name: 'Bilhetagem', value: ticketingFrauds.length },
    { name: 'Compartilhamento', value: cardSharingEvents.length },
    { name: 'Revenda', value: informalSalesEvents.length },
    { name: 'Comportamento', value: userBehaviorProfiles.length },
  ],
  criticalCards: [
    { cardId: 'RIO-221903', module: 'Transações suspeitas', riskLevel: 'alto', score: 96, detail: 'Anomalia de score com recorrência em revenda e bilhetagem.' },
    { cardId: 'RIO-784112', module: 'Bilhetagem', riskLevel: 'alto', score: 91, detail: 'Revalidações sequenciais acima do padrão histórico.' },
    { cardId: 'RIO-112084', module: 'Compartilhamento', riskLevel: 'alto', score: 88, detail: 'Uso em locais incompatíveis em janelas de 8 minutos.' },
    { cardId: 'RIO-903551', module: 'Comportamento', riskLevel: 'medio', score: 74, detail: 'Desvio relevante entre padrão normal e uso noturno atual.' },
  ],
};
