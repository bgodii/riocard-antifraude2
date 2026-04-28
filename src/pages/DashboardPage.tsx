import { useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, FileSpreadsheet, Radar, ShieldCheck, UploadCloud } from 'lucide-react';
import { CardResumo } from '@/components/CardResumo';
import { GraficoBarra } from '@/components/GraficoBarra';
import { GraficoPizza } from '@/components/GraficoPizza';
import { BadgeRisco } from '@/components/BadgeRisco';
import { ChartsSection } from '@/components/ChartsSection';
import { DataTable } from '@/components/DataTable';
import { FileUpload } from '@/components/FileUpload';
import { MetricsCards } from '@/components/MetricsCards';
import { PageHeader } from '@/components/PageHeader';
import { PreviewTable } from '@/components/PreviewTable';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import type { FilterState, FraudAlert, SortState } from '@/types/fraud';
import { buildAnalytics, filterAlerts } from '@/utils/analytics';
import { formatCompactNumber } from '@/utils/format';
import { parseSpreadsheetFile } from '@/utils/spreadsheet';

const initialSort: SortState = {
  column: 'dateTime',
  direction: 'desc',
};

const emptyFilters: FilterState = {
  cardId: '',
  fraudType: 'all',
  station: 'all',
  line: 'all',
  startDate: '',
  endDate: '',
};

function prettifyFraudType(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCriticalCards(alerts: FraudAlert[]) {
  const grouped = new Map<string, FraudAlert[]>();

  for (const alert of alerts) {
    const collection = grouped.get(alert.cardId) ?? [];
    collection.push(alert);
    grouped.set(alert.cardId, collection);
  }

  return [...grouped.entries()]
    .map(([cardId, cardAlerts]) => {
      const topAlert = [...cardAlerts].sort((left, right) => right.riskPoints - left.riskPoints)[0];

      return {
        cardId,
        module: prettifyFraudType(topAlert.fraudType),
        riskLevel: topAlert.riskScore,
        score: topAlert.riskPoints,
        detail: topAlert.reason,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

export function DashboardPage() {
  const { dataset, sourceLabel, setDatasetFromRows } = useMonitoringData();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);

  const uploadAnalytics = useMemo(() => buildAnalytics(dataset.alerts, dataset.stats), [dataset]);
  const previewRows = useMemo(() => dataset.transactions.slice(0, 8), [dataset]);
  const sortedAlerts = useMemo(() => filterAlerts(dataset.alerts, emptyFilters, sort), [dataset.alerts, sort]);
  const nativeSuspiciousCount = useMemo(
    () => dataset.transactions.filter((transaction) => transaction.suspiciousFlag || transaction.suspiciousCategory).length,
    [dataset.transactions],
  );
  const hybridAlertCount = useMemo(
    () => dataset.alerts.filter((alert) => alert.source === 'hibrido').length,
    [dataset.alerts],
  );
  const highRiskCardCount = useMemo(
    () => new Set(dataset.alerts.filter((alert) => alert.riskScore === 'alto').map((alert) => alert.cardId)).size,
    [dataset.alerts],
  );
  const highRiskPercentage = useMemo(() => {
    if (!dataset.stats.uniqueCards) {
      return 0;
    }

    return Number(((highRiskCardCount / dataset.stats.uniqueCards) * 100).toFixed(1));
  }, [dataset.stats.uniqueCards, highRiskCardCount]);
  const fraudTypeCount = useMemo(() => new Set(dataset.alerts.map((alert) => alert.fraudType)).size, [dataset.alerts]);
  const riskDistribution = useMemo(() => {
    const high = dataset.alerts.filter((alert) => alert.riskScore === 'alto').length;
    const medium = dataset.alerts.filter((alert) => alert.riskScore === 'medio').length;
    const low = dataset.alerts.filter((alert) => alert.riskScore === 'baixo').length;

    return [
      { name: 'Alto risco', value: high },
      { name: 'Medio risco', value: medium },
      { name: 'Baixo risco', value: low },
    ];
  }, [dataset.alerts]);
  const alertVolumeByType = useMemo(
    () =>
      uploadAnalytics.fraudByType.map((item) => ({
        name: item.name,
        value: item.total,
      })),
    [uploadAnalytics.fraudByType],
  );
  const criticalCards = useMemo(() => buildCriticalCards(dataset.alerts), [dataset.alerts]);
  const totalPages = Math.max(1, Math.ceil(sortedAlerts.length / 8));
  const currentPage = Math.min(page, totalPages);

  const handleDataset = (rows: Record<string, unknown>[], label: string) => {
    setDatasetFromRows(rows, label);
    setError(null);
    setSort(initialSort);
    setPage(1);
  };

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const rows = await parseSpreadsheetFile(file);
      handleDataset(rows, `Arquivo carregado: ${file.name}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel processar a planilha.');
    } finally {
      setUploading(false);
    }
  };

  const handleUseDemo = () => {
    setUploading(true);

    window.setTimeout(() => {
      import('@/data/demoData').then(({ demoSpreadsheetRows }) => {
        handleDataset(demoSpreadsheetRows, 'Base demonstrativa carregada');
        setUploading(false);
      });
    }, 250);
  };

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-line bg-gradient-to-r from-[#eef6ff] via-white to-[#fff8df] p-6">
        <PageHeader
          eyebrow="Visao executiva"
          title="Monitoramento consolidado de cartoes Riocard"
          description="Uma central analitica com linguagem visual inspirada na Riocard Mais: clara, confiavel e orientada a servico, sem perder profundidade operacional."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          title="Cartoes monitorados"
          value={formatCompactNumber(dataset.stats.uniqueCards)}
          subtitle="Base consolidada ativa em todos os modulos."
          icon={<CreditCard size={22} />}
        />
        <CardResumo
          title="% alto risco"
          value={`${highRiskPercentage}%`}
          subtitle="Percentual acima do limiar operacional."
          icon={<Radar size={22} />}
          tone="danger"
        />
        <CardResumo
          title="Alertas ativos"
          value={`${dataset.alerts.length}`}
          subtitle="Ocorrencias aguardando triagem ou acao."
          icon={<AlertTriangle size={22} />}
          tone="warning"
        />
        <CardResumo
          title="Tipos de fraude"
          value={`${fraudTypeCount}`}
          subtitle="Familias analiticas identificadas na base carregada."
          icon={<ShieldCheck size={22} />}
          tone="success"
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-panel">Upload de planilha</h2>
              <p className="text-sm text-slate-600">Envie CSV, XLS ou XLSX para gerar alertas e explorar a base no dashboard.</p>
            </div>
          </div>

          <FileUpload onFileSelected={handleFileSelected} onUseDemo={handleUseDemo} loading={uploading} />

          <div className="mt-5 rounded-3xl border border-line bg-[#f8fbff] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-panel">
                <FileSpreadsheet size={16} className="text-accent" />
                {sourceLabel}
              </div>
              <span className="rounded-full border border-[#b7d6f5] bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600">
                {dataset.rawRows.length} linhas brutas
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Transacoes validas</p>
                <p className="mt-2 text-2xl font-semibold text-panel">{dataset.transactions.length}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Suspeitas da planilha</p>
                <p className="mt-2 text-2xl font-semibold text-panel">{nativeSuspiciousCount}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alertas hibridos</p>
                <p className="mt-2 text-2xl font-semibold text-panel">{dataset.alerts.length}</p>
                <p className="mt-1 text-xs text-slate-500">{hybridAlertCount} correlacionados por mais de uma fonte</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cartoes unicos</p>
                <p className="mt-2 text-2xl font-semibold text-panel">{dataset.stats.uniqueCards}</p>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-panel">Resumo rapido da base carregada</h2>
            <p className="text-sm text-slate-600">Amostra das primeiras transacoes normalizadas para conferencia operacional.</p>
          </div>
          <PreviewTable rows={previewRows} />
        </article>
      </section>

      <section className="space-y-6 rounded-3xl border border-line bg-gradient-to-br from-[#f7fbff] to-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-panel">Analise dinamica da planilha</h2>
            <p className="text-sm text-slate-600">Os indicadores abaixo sao recalculados sempre que uma nova planilha e carregada.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Base ativa</span>
        </div>

        <MetricsCards analytics={uploadAnalytics} />
        <ChartsSection analytics={uploadAnalytics} />

        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-panel">Alertas gerados pela planilha</h3>
              <p className="text-sm text-slate-600">Tabela operacional para triagem imediata dos eventos suspeitos detectados.</p>
            </div>
            <span className="text-sm text-slate-500">
              {sortedAlerts.length} alerta{sortedAlerts.length === 1 ? '' : 's'} | pagina {currentPage}/{totalPages}
            </span>
          </div>

          <DataTable
            alerts={sortedAlerts}
            page={currentPage}
            pageSize={8}
            sort={sort}
            onSortChange={(nextSort) => {
              setSort(nextSort);
              setPage(1);
            }}
            onPageChange={setPage}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-panel">Volume de alertas por tipo</h2>
            <p className="text-sm text-slate-600">Consolidacao por modelo analitico da plataforma.</p>
          </div>
          <GraficoBarra data={alertVolumeByType} xKey="name" yKey="value" />
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-panel">Distribuicao de risco</h2>
            <p className="text-sm text-slate-600">Quantidade de alertas classificados em alto, medio e baixo risco na base atual.</p>
          </div>
          <GraficoPizza
            data={riskDistribution}
            dataKey="value"
            nameKey="name"
            centerLabel="Total"
            valueLabel="alertas"
            descriptions={{
              'Alto risco': 'Alertas que exigem acao prioritaria por criticidade elevada.',
              'Medio risco': 'Alertas que merecem acompanhamento e validacao operacional.',
              'Baixo risco': 'Alertas com menor criticidade, mantidos sob monitoramento.',
            }}
          />
        </section>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-panel">Cartoes mais criticos</h2>
            <p className="text-sm text-slate-600">Priorizacao sugerida para investigacao antifraude.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Top investigacao</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {criticalCards.map((card) => (
            <article key={card.cardId} className="rounded-3xl border border-line bg-[#f8fbff] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.module}</p>
                  <h3 className="mt-2 text-xl font-semibold text-panel">{card.cardId}</h3>
                </div>
                <BadgeRisco level={card.riskLevel} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="max-w-xl text-sm leading-6 text-slate-600">{card.detail}</p>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Score</p>
                  <p className="text-3xl font-semibold text-panel">{card.score}</p>
                </div>
              </div>
            </article>
          ))}

          {!criticalCards.length ? (
            <article className="rounded-3xl border border-line bg-[#f8fbff] p-5 text-sm text-slate-500">
              Nenhum cartao critico identificado na base atual.
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}
