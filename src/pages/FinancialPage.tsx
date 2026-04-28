import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  Layers3,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CardResumo } from '@/components/CardResumo';
import { FileUpload } from '@/components/FileUpload';
import { PageHeader } from '@/components/PageHeader';
import {
  buildFinancialDashboard,
  buildFinancialFilterOptions,
  demoFinancialRows,
  normalizeFinancialRows,
} from '@/services/financial';
import type {
  FinancialDashboardData,
  FinancialFilterState,
  FinancialIndicatorInfo,
  FinancialInsight,
  FinancialInsightTone,
  FinancialRankingItem,
} from '@/types/financial';
import { formatCompactNumber, formatCurrency } from '@/utils/format';
import { parseSpreadsheetFile } from '@/utils/spreadsheet';

const initialFilters: FinancialFilterState = {
  startMonth: 'all',
  endMonth: 'all',
  category: 'all',
  type: 'all',
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cfe0f5',
  borderRadius: '16px',
  color: '#12345b',
};

const xAxisProps = {
  stroke: '#56708f',
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 10 },
  tickMargin: 12,
  minTickGap: 18,
  interval: 'preserveStartEnd' as const,
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-panel">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RankingList({
  title,
  items,
  tone,
}: {
  title: string;
  items: FinancialRankingItem[];
  tone: 'revenue' | 'cost';
}) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-panel">{title}</h2>
        <p className="text-sm text-slate-600">Ranking automatico das categorias com maior peso no periodo filtrado.</p>
      </div>

      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.category} className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">#{index + 1}</p>
                  <p className="mt-1 font-semibold text-panel">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className={tone === 'revenue' ? 'text-base font-semibold text-accent' : 'text-base font-semibold text-danger'}>
                    {formatCurrency(item.value)}
                  </p>
                  <p className="text-sm text-slate-500">{formatPercent(item.share)}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-6 text-sm text-slate-500">
            Nenhum dado disponivel para o ranking atual.
          </div>
        )}
      </div>
    </section>
  );
}

function InsightCard({ insight }: { insight: FinancialInsight }) {
  const toneStyles: Record<FinancialInsightTone, string> = {
    info: 'border-[#b7d6f5] bg-[#eef6ff] text-panel',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-[#ffd768] bg-[#fff8df] text-slate-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
  };

  return (
    <article className={`rounded-3xl border p-4 ${toneStyles[insight.tone]}`}>
      <p className="text-sm font-semibold">{insight.title}</p>
      <p className="mt-2 text-sm leading-6">{insight.description}</p>
    </article>
  );
}

function IndicatorCard({ indicator }: { indicator: FinancialIndicatorInfo }) {
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-panel">{indicator.title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            indicator.type === 'receita' ? 'bg-[#eef6ff] text-accent' : 'bg-rose-50 text-danger'
          }`}
        >
          {indicator.type}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{indicator.description}</p>
      <p className="mt-3 text-sm font-medium text-panel">Impacto no negocio: {indicator.impact}</p>
    </article>
  );
}

function RevenueChart({ dashboard }: { dashboard: FinancialDashboardData }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={dashboard.history}>
          <CartesianGrid stroke="rgba(4, 84, 163, 0.10)" vertical={false} />
          <XAxis dataKey="monthLabel" {...xAxisProps} />
          <YAxis stroke="#56708f" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <Line type="monotone" dataKey="revenue" stroke="#0454a3" strokeWidth={3} dot={{ r: 4 }} name="Receita" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CostChart({ dashboard }: { dashboard: FinancialDashboardData }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart data={dashboard.costByCategoryChart}>
          <CartesianGrid stroke="rgba(4, 84, 163, 0.10)" vertical={false} />
          <XAxis dataKey="monthLabel" {...xAxisProps} />
          <YAxis stroke="#56708f" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <Legend wrapperStyle={{ color: '#56708f' }} />
          {dashboard.costSeries.map((series) => (
            <Bar key={series.key} dataKey={series.key} name={series.label} stackId="costs" fill={series.color} radius={[8, 8, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MarginChart({ dashboard }: { dashboard: FinancialDashboardData }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={dashboard.history}>
          <CartesianGrid stroke="rgba(4, 84, 163, 0.10)" vertical={false} />
          <XAxis dataKey="monthLabel" {...xAxisProps} />
          <YAxis stroke="#56708f" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <ReferenceLine y={0} stroke="#f59e0b" strokeDasharray="5 5" />
          <Line type="monotone" dataKey="margin" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} name="Margem" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueVsCostChart({ dashboard }: { dashboard: FinancialDashboardData }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <ComposedChart data={dashboard.history}>
          <CartesianGrid stroke="rgba(4, 84, 163, 0.10)" vertical={false} />
          <XAxis dataKey="monthLabel" {...xAxisProps} />
          <YAxis stroke="#56708f" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <Legend wrapperStyle={{ color: '#56708f' }} />
          <Bar dataKey="revenue" name="Receita" fill="#0454a3" radius={[8, 8, 0, 0]} />
          <Bar dataKey="cost" name="Custo" fill="#ff9f1c" radius={[8, 8, 0, 0]} />
          <Line type="monotone" dataKey="margin" name="Margem" stroke="#22c55e" strokeWidth={3} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastChart({ dashboard }: { dashboard: FinancialDashboardData }) {
  const history = dashboard.combinedTimeline.filter((point) => point.phase === 'historico');
  const chartData = dashboard.combinedTimeline.map((point) => ({
    ...point,
    revenueHistorical: point.phase === 'historico' ? point.revenue : null,
    revenueForecast: point.phase === 'previsao' ? point.revenue : null,
    costHistorical: point.phase === 'historico' ? point.cost : null,
    costForecast: point.phase === 'previsao' ? point.cost : null,
    marginHistorical: point.phase === 'historico' ? point.margin : null,
    marginForecast: point.phase === 'previsao' ? point.margin : null,
  }));

  return (
    <div className="mx-auto h-80 w-full max-w-5xl">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(4, 84, 163, 0.10)" vertical={false} />
          <XAxis dataKey="monthLabel" {...xAxisProps} />
          <YAxis stroke="#56708f" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <Legend wrapperStyle={{ color: '#56708f' }} />
          <ReferenceLine x={history.at(-1)?.monthLabel} stroke="#ff9f1c" strokeDasharray="6 6" />
          <Line type="monotone" dataKey="revenueHistorical" stroke="#0454a3" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} name="Receita historica" />
          <Line type="monotone" dataKey="revenueForecast" stroke="#0454a3" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 3 }} connectNulls={false} name="Receita prevista" />
          <Line type="monotone" dataKey="costHistorical" stroke="#ff9f1c" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} name="Custo historico" />
          <Line type="monotone" dataKey="costForecast" stroke="#ff9f1c" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 3 }} connectNulls={false} name="Custo previsto" />
          <Line type="monotone" dataKey="marginHistorical" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} name="Margem historica" />
          <Line type="monotone" dataKey="marginForecast" stroke="#22c55e" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 3 }} connectNulls={false} name="Margem prevista" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinancialPage() {
  const [entries, setEntries] = useState(() => [] as typeof demoFinancialEntries);
  const [filters, setFilters] = useState<FinancialFilterState>(initialFilters);
  const [uploading, setUploading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('Nenhuma base financeira carregada');
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useMemo(() => buildFinancialFilterOptions(entries), [entries]);
  const dashboard = useMemo(() => buildFinancialDashboard(entries, filters), [entries, filters]);

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const rows = await parseSpreadsheetFile(file);
      const nextEntries = normalizeFinancialRows(rows);

      if (!nextEntries.length) {
        throw new Error('Nao foi possivel identificar linhas validas na base financeira enviada.');
      }

      setEntries(nextEntries);
      setSourceLabel(`Arquivo carregado: ${file.name}`);
      setFilters(initialFilters);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel processar a base financeira.');
    } finally {
      setUploading(false);
    }
  };

  const handleUseDemo = () => {
    setUploading(true);

    window.setTimeout(() => {
      setEntries(normalizeFinancialRows(demoFinancialRows));
      setSourceLabel('Base financeira demonstrativa carregada');
      setFilters(initialFilters);
      setError(null);
      setUploading(false);
    }, 250);
  };

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-line bg-gradient-to-r from-[#eef6ff] via-white to-[#fff8df] p-6">
        <PageHeader
          eyebrow="Financeiro & Previsao"
          title="Painel executivo de receitas, custos e projecoes futuras"
          description="Consolide historico financeiro da operacao Riocard, entenda margens, visualize a composicao de custos e receitas e antecipe riscos para os proximos 6 meses."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-panel">Upload de base financeira</h2>
            <p className="text-sm text-slate-600">
              Aceite de arquivos CSV ou XLSX com colunas de data, tipo, categoria, subcategoria e valor.
            </p>
          </div>

          <FileUpload onFileSelected={handleFileSelected} onUseDemo={handleUseDemo} loading={uploading} />

          <div className="mt-5 rounded-3xl border border-line bg-[#f8fbff] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-panel">{sourceLabel}</div>
              <span className="rounded-full border border-[#b7d6f5] bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600">
                {dashboard.filteredEntries.length} lancamentos ativos
              </span>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-panel">Filtros executivos</h2>
            <p className="text-sm text-slate-600">Refine o recorte por periodo, categoria e natureza do lancamento.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Data inicial"
              value={filters.startMonth}
              onChange={(value) => setFilters((current) => ({ ...current, startMonth: value }))}
              options={[
                { label: 'Todo o historico', value: 'all' },
                ...filterOptions.months.map((month) => ({
                  label: filterOptions.monthLabels[month],
                  value: month,
                })),
              ]}
            />

            <SelectField
              label="Data final"
              value={filters.endMonth}
              onChange={(value) => setFilters((current) => ({ ...current, endMonth: value }))}
              options={[
                { label: 'Todo o historico', value: 'all' },
                ...filterOptions.months.map((month) => ({
                  label: filterOptions.monthLabels[month],
                  value: month,
                })),
              ]}
            />

            <SelectField
              label="Categoria"
              value={filters.category}
              onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
              options={[
                { label: 'Todas as categorias', value: 'all' },
                ...filterOptions.categories.map((category) => ({
                  label: category,
                  value: category,
                })),
              ]}
            />

            <SelectField
              label="Tipo"
              value={filters.type}
              onChange={(value) => setFilters((current) => ({ ...current, type: value as FinancialFilterState['type'] }))}
              options={[
                { label: 'Receita + Custo', value: 'all' },
                { label: 'Receita', value: 'receita' },
                { label: 'Custo', value: 'custo' },
              ]}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Historico mensal</p>
              <p className="mt-2 text-2xl font-semibold text-panel">{dashboard.history.length}</p>
              <p className="mt-1 text-sm text-slate-600">meses consolidados</p>
            </div>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Previsao futura</p>
              <p className="mt-2 text-2xl font-semibold text-panel">{dashboard.forecast.length}</p>
              <p className="mt-1 text-sm text-slate-600">meses projetados</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <CardResumo
          title="Receita total"
          value={formatCurrency(dashboard.kpis.revenueTotal)}
          subtitle="Somatorio historico de receitas no recorte atual."
          icon={<Landmark size={22} />}
        />
        <CardResumo
          title="Custo total"
          value={formatCurrency(dashboard.kpis.costTotal)}
          subtitle="Somatorio historico de custos observados."
          icon={<TrendingDown size={22} />}
          tone="danger"
        />
        <CardResumo
          title="Margem total"
          value={formatCurrency(dashboard.kpis.marginTotal)}
          subtitle="Resultado acumulado entre receita e custo."
          icon={<CircleDollarSign size={22} />}
          tone={dashboard.kpis.marginTotal >= 0 ? 'success' : 'danger'}
        />
        <CardResumo
          title="Margem (%)"
          value={formatPercent(dashboard.kpis.marginPct)}
          subtitle="Percentual de margem sobre a receita total."
          icon={<ShieldCheck size={22} />}
          tone={dashboard.kpis.marginPct >= 0 ? 'success' : 'danger'}
        />
        <CardResumo
          title="Crescimento mes a mes"
          value={formatPercent(dashboard.kpis.monthOverMonthGrowth)}
          subtitle="Variacao da receita do ultimo mes contra o anterior."
          icon={dashboard.kpis.monthOverMonthGrowth >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
          tone={dashboard.kpis.monthOverMonthGrowth >= 0 ? 'success' : 'warning'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Receita mensal" description="Evolucao da receita ao longo do historico carregado.">
          <RevenueChart dashboard={dashboard} />
        </ChartCard>

        <ChartCard title="Custos por categoria" description="Composicao mensal dos principais grupos de custo.">
          <CostChart dashboard={dashboard} />
        </ChartCard>

        <ChartCard title="Margem mensal" description="Margem financeira por mes, com destaque visual para a linha de equilibrio.">
          <MarginChart dashboard={dashboard} />
        </ChartCard>

        <ChartCard title="Comparativo Receita vs Custo" description="Visao combinada entre receita, custo e margem historica.">
          <RevenueVsCostChart dashboard={dashboard} />
        </ChartCard>
      </div>

      <ChartCard
        title="Forecast de 6 meses"
        description="Projecao de receita, custo e margem usando media movel e tendencia linear simples, com historico e previsao separados visualmente."
      >
        <ForecastChart dashboard={dashboard} />
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-2xl border border-[#ffd768] bg-[#fff8df] p-3 text-brandWarm">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-panel">Impactos e Riscos</h2>
              <p className="text-sm text-slate-600">Leitura automatica do comportamento financeiro recente e do impacto da previsao futura.</p>
            </div>
          </div>

          <div className="space-y-3">
            {dashboard.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-line bg-[#f8fbff] p-4">
            <p className="text-sm font-semibold text-panel">Meses criticos detectados</p>
            <p className="mt-2 text-3xl font-semibold text-panel">{dashboard.kpis.monthsCritical}</p>
            <p className="mt-1 text-sm text-slate-600">Meses historicos com margem negativa automaticamente destacados pelo modulo.</p>
          </div>
        </section>

        <div className="space-y-6">
          <RankingList title="Maiores receitas" items={dashboard.topRevenues} tone="revenue" />
          <RankingList title="Maiores custos" items={dashboard.topCosts} tone="cost" />
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
            <Layers3 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-panel">Entenda os Indicadores</h2>
            <p className="text-sm text-slate-600">Explicacao simples dos principais grupos de receita e custo usados nos graficos e KPIs.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {dashboard.indicatorInfo.map((indicator) => (
            <IndicatorCard key={indicator.title} indicator={indicator} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-panel">Resumo executivo rapido</h2>
          <p className="text-sm text-slate-600">Leitura de alto nivel para tomada de decisao da operacao de bilhetagem.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-line bg-[#f8fbff] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Receitas monitoradas</p>
            <p className="mt-2 text-3xl font-semibold text-accent">{formatCompactNumber(dashboard.revenueCategoryBreakdown.length)}</p>
            <p className="mt-2 text-sm text-slate-600">categorias com participacao no periodo filtrado</p>
          </article>

          <article className="rounded-3xl border border-line bg-[#fff7f7] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Custos monitorados</p>
            <p className="mt-2 text-3xl font-semibold text-danger">{formatCompactNumber(dashboard.costCategoryBreakdown.length)}</p>
            <p className="mt-2 text-sm text-slate-600">categorias com impacto direto no resultado</p>
          </article>

          <article className="rounded-3xl border border-line bg-[#f4fff7] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Margem prevista media</p>
            <p className="mt-2 text-3xl font-semibold text-success">
              {formatCurrency(
                dashboard.forecast.length
                  ? dashboard.forecast.reduce((total, item) => total + item.margin, 0) / dashboard.forecast.length
                  : 0,
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600">media mensal para os proximos 6 meses</p>
          </article>

          <article className="rounded-3xl border border-line bg-[#fff8df] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Base ativa</p>
            <p className="mt-2 text-3xl font-semibold text-panel">{dashboard.filteredEntries.length}</p>
            <p className="mt-2 text-sm text-slate-600">lancamentos financeiros atualmente em analise</p>
          </article>
        </div>
      </section>
    </section>
  );
}
