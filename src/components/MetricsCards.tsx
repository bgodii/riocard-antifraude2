import { AlertTriangle, MapPinned, ShieldAlert, Users } from 'lucide-react';
import type { AnalyticsBundle } from '@/types/fraud';

interface MetricsCardsProps {
  analytics: AnalyticsBundle;
}

export function MetricsCards({ analytics }: MetricsCardsProps) {
  const cards = [
    {
      label: 'Total de fraudes detectadas',
      value: analytics.totalAlerts,
      icon: ShieldAlert,
      tone: 'bg-[#eef6ff] border-[#b7d6f5]',
      helper: analytics.topFraudType === 'Sem dados' ? 'Sem ocorrencias' : `Tipo dominante: ${analytics.topFraudType}`,
    },
    {
      label: 'Alertas de alto risco',
      value: analytics.highRiskAlerts,
      icon: AlertTriangle,
      tone: 'bg-[#fff9e7] border-[#ffd768]',
      helper: analytics.totalAlerts ? `${Math.round((analytics.highRiskAlerts / analytics.totalAlerts) * 100)}% do total` : '0% do total',
    },
    {
      label: 'Cartoes com suspeitas',
      value: analytics.uniqueCards,
      icon: Users,
      tone: 'bg-[#f4fff7] border-emerald-200',
      helper: analytics.topCard === 'Sem dados' ? 'Sem cartoes suspeitos' : `Maior incidencia: ${analytics.topCard}`,
    },
    {
      label: 'Locais com ocorrencias',
      value: analytics.suspiciousLocations,
      icon: MapPinned,
      tone: 'bg-[#fff4e8] border-[#ffd8aa]',
      helper: analytics.topStation === 'Sem dados' ? 'Sem estacao dominante' : `Estacao critica: ${analytics.topStation}`,
    },
  ] as const;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, helper, icon: Icon, tone }) => (
        <article key={label} className={`rounded-[28px] border p-5 shadow-sm ${tone}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-3 text-4xl font-semibold text-panel">{value}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white p-3 text-accent shadow-sm">
              <Icon size={20} />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{helper}</p>
        </article>
      ))}
    </section>
  );
}
