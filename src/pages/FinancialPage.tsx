import { CircleDollarSign, Landmark, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CardResumo } from '@/components/CardResumo';
import { Filtro } from '@/components/Filtro';
import { GraficoBarra } from '@/components/GraficoBarra';
import { GraficoLinha } from '@/components/GraficoLinha';
import { GraficoPizza } from '@/components/GraficoPizza';
import { PageHeader } from '@/components/PageHeader';
import { financialSnapshots } from '@/services/financial';
import type { PeriodFilter } from '@/types/financial';
import { formatCurrency } from '@/utils/format';

export function FinancialPage() {
  const [period, setPeriod] = useState<PeriodFilter>('semana');
  const snapshot = useMemo(
    () => financialSnapshots.find((item) => item.period === period) ?? financialSnapshots[1],
    [period],
  );

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Financeiro"
        title="Impacto financeiro e receita"
        description="Cruze faturamento, tipos de uso e perdas potenciais para apoiar priorização antifraude e tomada de decisão."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Filtro
          label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { label: 'Dia', value: 'dia' },
            { label: 'Semana', value: 'semana' },
            { label: 'Mês', value: 'mes' },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardResumo
          title="Receita em monitoramento"
          value={formatCurrency(snapshot.trend.reduce((sum, item) => sum + item.revenue, 0))}
          subtitle="Receita total no período selecionado."
          icon={<Landmark size={22} />}
        />
        <CardResumo
          title="Impacto estimado"
          value={formatCurrency(snapshot.potentialLoss)}
          subtitle="Valor potencial perdido por fraudes."
          icon={<TrendingDown size={22} />}
          tone="danger"
        />
        <CardResumo
          title="Valor recuperado"
          value={formatCurrency(snapshot.recoveredValue)}
          subtitle="Recuperação operacional já capturada."
          icon={<CircleDollarSign size={22} />}
          tone="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-panel/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Receita ao longo do tempo</h2>
            <p className="text-sm text-slate-400">Volume financeiro versus perdas potenciais por período.</p>
          </div>
          <GraficoLinha data={snapshot.trend} xKey="period" yKey="revenue" color="#22c55e" />
        </section>

        <section className="rounded-3xl border border-white/10 bg-panel/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Faturamento por tipo de uso</h2>
            <p className="text-sm text-slate-400">Participação por modal ou tipo de operação.</p>
          </div>
          <GraficoPizza data={snapshot.usageMix} dataKey="value" nameKey="category" colors={['#14b8a6', '#38bdf8', '#f59e0b', '#ef4444']} />
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-panel/70 p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Perdas por período</h2>
          <p className="text-sm text-slate-400">Curva estimada de perda financeira associada a eventos suspeitos.</p>
        </div>
        <GraficoBarra data={snapshot.trend} xKey="period" yKey="fraudLoss" colors={['#ef4444', '#f97316', '#f59e0b', '#fb7185', '#dc2626']} />
      </section>
    </section>
  );
}
