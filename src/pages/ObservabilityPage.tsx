import clsx from 'clsx';
import {
  Activity,
  AlertTriangle,
  Bot,
  Download,
  Eye,
  Play,
  RefreshCcw,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardResumo } from '@/components/CardResumo';
import { PageHeader } from '@/components/PageHeader';
import { useFinancialData } from '@/context/FinancialDataContext';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import {
  exportAuditCsv,
  exportAuditJson,
  exportExecutiveReport,
  getObservabilityHistory,
  runFullAudit,
  startMonitoring,
} from '@/services/observability';
import type { AuditImpact, AuditStatus, ObservabilityAuditRun } from '@/types/observability';

const intervalOptions = [
  { label: '1 min', value: 60_000 },
  { label: '5 min', value: 300_000 },
  { label: '15 min', value: 900_000 },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const styles: Record<AuditStatus, string> = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    alerta: 'border-[#ffd768] bg-[#fff8df] text-[#8a5b00]',
    erro: 'border-rose-200 bg-rose-50 text-rose-800',
    regressao: 'border-rose-300 bg-rose-100 text-rose-900',
  };

  const labels: Record<AuditStatus, string> = {
    ok: 'OK',
    alerta: 'ALERTA',
    erro: 'ERRO',
    regressao: 'REGRESSAO CRITICA',
  };

  return <span className={clsx('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', styles[status])}>{labels[status]}</span>;
}

function ImpactBadge({ impact }: { impact: AuditImpact }) {
  const styles: Record<AuditImpact, string> = {
    baixo: 'bg-[#eef6ff] text-accent',
    medio: 'bg-[#fff8df] text-[#8a5b00]',
    alto: 'bg-[#ffe7d1] text-[#b45700]',
    critico: 'bg-rose-50 text-rose-800',
  };

  return <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', styles[impact])}>{impact}</span>;
}

export function ObservabilityPage() {
  const { dataset, sourceLabel } = useMonitoringData();
  const { entries: financialEntries, sourceLabel: financialSourceLabel } = useFinancialData();
  const [currentRun, setCurrentRun] = useState<ObservabilityAuditRun | null>(null);
  const [history, setHistory] = useState<ObservabilityAuditRun[]>(() => getObservabilityHistory());
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [intervalMs, setIntervalMs] = useState(300_000);

  const latestRun = currentRun ?? history[0] ?? null;

  const executeAudit = () => {
    const run = runFullAudit({
      dataset,
      financialEntries,
    });

    setCurrentRun(run);
    setHistory(getObservabilityHistory());
    return run;
  };

  useEffect(() => {
    if (!monitoringEnabled) {
      return undefined;
    }

    const stop = startMonitoring(intervalMs, executeAudit, (run) => {
      setCurrentRun(run);
      setHistory(getObservabilityHistory());
    });

    return stop;
  }, [dataset, financialEntries, intervalMs, monitoringEnabled]);

  const failures = useMemo(() => latestRun?.tests.filter((test) => test.status !== 'ok') ?? [], [latestRun]);

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-line bg-gradient-to-r from-[#eef6ff] via-white to-[#fff8df] p-6">
        <PageHeader
          eyebrow="Observabilidade & Validacao"
          title="Agente autonomo de validacao e observabilidade"
          description="Um observador inteligente da aplicacao Riocard que audita o front-end, simula comportamento real, detecta regressao, aprende com falhas anteriores e monitora continuamente a operacao."
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
        <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-panel">Controle do agente</h2>
              <p className="text-sm text-slate-600">Execute uma auditoria completa agora ou deixe o monitor rodando continuamente.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={executeAudit}
                className="inline-flex items-center gap-2 rounded-2xl bg-panel px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3f73]"
              >
                <Play size={16} />
                Executar auditoria completa
              </button>
              <button
                type="button"
                onClick={() => setMonitoringEnabled((current) => !current)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                  monitoringEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-line bg-[#f8fbff] text-panel hover:bg-white',
                )}
              >
                <Activity size={16} />
                {monitoringEnabled ? 'Monitor ativo' : 'Ativar monitor'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Base antifraude</p>
              <p className="mt-2 text-sm font-semibold text-panel">{sourceLabel}</p>
            </div>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Base financeira</p>
              <p className="mt-2 text-sm font-semibold text-panel">{financialSourceLabel}</p>
            </div>
            <label className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Intervalo do monitor</span>
              <select
                value={intervalMs}
                onChange={(event) => setIntervalMs(Number(event.target.value))}
                className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              >
                {intervalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ultima execucao</p>
              <p className="mt-2 text-sm font-semibold text-panel">{latestRun ? formatDateTime(latestRun.executedAt) : 'Ainda nao executado'}</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-panel">Cobertura do agente</h2>
              <p className="text-sm text-slate-600">O motor audita regras, graficos, forecast, antifraude, automacoes, Copilot e simulacao de usuario.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-700">ValidationEngine recalcula receitas, custos, margem, score de risco e consistencia dos dados.</div>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-700">BehaviorSimulator percorre upload, filtros, acoes operacionais e atendimento conversacional.</div>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-700">AnomalyDetector procura concentracao suspeita, outliers de forecast e pressao operacional.</div>
            <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-700">LearningModule guarda falhas anteriores e marca regressao critica quando um teste piora.</div>
          </div>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          title="% de acerto geral"
          value={`${latestRun?.summary.accuracyPct ?? 0}%`}
          subtitle="Percentual de testes que passaram na ultima execucao."
          icon={<ShieldCheck size={22} />}
          tone="success"
        />
        <CardResumo
          title="Erros"
          value={`${latestRun?.summary.errors ?? 0}`}
          subtitle="Falhas funcionais ou de resultado incorreto."
          icon={<AlertTriangle size={22} />}
          tone="danger"
        />
        <CardResumo
          title="Regressoes"
          value={`${latestRun?.summary.regressions ?? 0}`}
          subtitle="Testes que antes passavam e agora pioraram."
          icon={<Siren size={22} />}
          tone="warning"
        />
        <CardResumo
          title="Ultimos testes"
          value={`${latestRun?.summary.totalTests ?? 0}`}
          subtitle="Quantidade auditada na ultima rodada completa."
          icon={<RefreshCcw size={22} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-panel">Relatorio detalhado</h2>
              <p className="text-sm text-slate-600">Esperado vs obtido, impacto e recomendacao para cada validacao executada.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!latestRun}
                onClick={() => latestRun && exportAuditJson(latestRun)}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-[#f8fbff] px-3 py-2 text-sm font-medium text-panel transition hover:bg-white disabled:opacity-50"
              >
                <Download size={15} />
                JSON
              </button>
              <button
                type="button"
                disabled={!latestRun}
                onClick={() => latestRun && exportAuditCsv(latestRun)}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-[#f8fbff] px-3 py-2 text-sm font-medium text-panel transition hover:bg-white disabled:opacity-50"
              >
                <Download size={15} />
                CSV
              </button>
              <button
                type="button"
                disabled={!latestRun}
                onClick={() => latestRun && exportExecutiveReport(latestRun)}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-[#f8fbff] px-3 py-2 text-sm font-medium text-panel transition hover:bg-white disabled:opacity-50"
              >
                <Download size={15} />
                Executivo
              </button>
            </div>
          </div>

          {latestRun ? (
            <div className="space-y-4">
              {latestRun.tests.map((test) => (
                <article key={test.id} className="rounded-3xl border border-line bg-[#fbfdff] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{test.suite.replaceAll('_', ' ')}</p>
                      <h3 className="mt-1 text-base font-semibold text-panel">{test.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={test.status} />
                      <ImpactBadge impact={test.impact} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Esperado</p>
                      <p className="mt-2 text-sm text-slate-700">{test.expected}</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Obtido</p>
                      <p className="mt-2 text-sm text-slate-700">{test.actual}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-700">{test.detail}</p>
                  <p className="mt-3 text-sm font-medium text-panel">Recomendacao: {test.recommendation}</p>

                  {test.evidence.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {test.evidence.map((item) => (
                        <span key={item} className="rounded-full border border-[#b7d6f5] bg-white px-3 py-1 text-xs text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#b7d6f5] bg-[#f8fbff] p-8 text-center text-sm text-slate-600">
              Execute a primeira auditoria para gerar o relatorio detalhado do agente.
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[#ffd768] bg-[#fff8df] p-3 text-brandWarm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-panel">Impactos, anomalias e aprendizado</h2>
                <p className="text-sm text-slate-600">Sinais priorizados pelo agente a partir das ultimas execucoes.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(latestRun?.anomalies ?? []).map((anomaly) => (
                <article key={anomaly.id} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-panel">{anomaly.title}</p>
                    <ImpactBadge impact={anomaly.severity} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{anomaly.description}</p>
                </article>
              ))}

              {!latestRun?.anomalies.length ? (
                <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-500">As anomalias aparecem apos a primeira execucao do agente.</div>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {(latestRun?.learningInsights ?? []).map((item) => (
                <article key={item.signature} className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-sm font-semibold text-panel">{item.signature}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.suggestedCause}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {item.occurrences} ocorrencia(s) | ultima vez em {formatDateTime(item.lastSeen)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-panel">BehaviorSimulator e Copilot</h2>
                <p className="text-sm text-slate-600">Simulacoes do uso real da aplicacao para encontrar regressao e quebra de experiencia.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(latestRun?.behaviorSteps ?? []).map((step) => (
                <article key={step.id} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-panel">{step.label}</p>
                    <StatusBadge status={step.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {(latestRun?.copilotSimulations ?? []).map((simulation) => (
                <article key={simulation.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-panel">{simulation.scenario}</p>
                    <StatusBadge status={simulation.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{simulation.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">Rota final: {simulation.route}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-panel">Timeline recente</h2>
            <p className="mt-1 text-sm text-slate-600">Historico das ultimas execucoes armazenadas pelo LearningModule no navegador.</p>

            <div className="mt-5 space-y-3">
              {history.slice(0, 6).map((run) => (
                <article key={run.id} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-panel">{formatDateTime(run.executedAt)}</p>
                    <StatusBadge status={run.summary.regressions > 0 ? 'regressao' : run.summary.errors > 0 ? 'erro' : 'ok'} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {run.summary.totalTests} testes | {run.summary.errors} erros | {run.summary.alerts} alertas | {run.summary.regressions} regressoes
                  </p>
                </article>
              ))}

              {!history.length ? (
                <div className="rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-500">A timeline sera preenchida apos a primeira auditoria completa.</div>
              ) : null}
            </div>

            {latestRun ? (
              <div className="mt-5 rounded-2xl border border-line bg-[#f8fbff] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Resumo operacional</p>
                <p className="mt-2 text-sm text-slate-700">
                  {latestRun.actionSummary.criticalCases} caso(s) criticos, {latestRun.actionSummary.blockedCards} cartao(oes) bloqueado(s) e{' '}
                  {latestRun.actionSummary.escalatedCases} caso(s) em analise humana.
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Top falhas da rodada: {failures.slice(0, 3).map((test) => test.name).join(' | ') || 'nenhuma falha relevante'}.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
