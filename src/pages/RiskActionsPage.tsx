import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Download, Lock, SearchCheck, ShieldBan } from 'lucide-react';
import { CardResumo } from '@/components/CardResumo';
import { PageHeader } from '@/components/PageHeader';
import { RiskActionsTable } from '@/components/RiskActionsTable';
import { RiskBadge } from '@/components/RiskBadge';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import {
  applyRiskActionOverride,
  buildManualRiskLog,
  buildNotificationMessage,
  buildRiskActionCases,
} from '@/services/riskActions';
import type { RiskActionCase, RiskActionOverride, RiskActionType } from '@/types/riskActions';
import { formatCurrency, formatDateTime } from '@/utils/format';

type RiskFilter = 'todos' | 'baixo' | 'medio' | 'alto' | 'critico';
type CardStatusFilter = 'todos' | 'ativo' | 'bloqueado';
type ActionFilter = 'todos' | RiskActionType;

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function exportRiskActionsCsv(rows: RiskActionCase[]) {
  const header = [
    'id_cartao',
    'score_risco_modelo',
    'nivel_risco',
    'tipos_fraude',
    'ultima_transacao',
    'local_ultima_transacao',
    'status_cartao',
    'status_caso',
    'acao_recomendada',
    'acao_executada',
  ];

  const body = rows.map((row) =>
    [
      row.cardId,
      row.score01.toFixed(2),
      row.riskLevel,
      row.fraudTypeLabels.join(' | '),
      row.lastTransactionDateTime,
      row.lastTransactionLocation,
      row.cardStatus,
      row.caseStatus,
      row.recommendedAction,
      row.executedActionSummary,
    ]
      .map((value) => escapeCsvValue(value))
      .join(','),
  );

  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'acoes_de_risco.csv';
  link.click();

  URL.revokeObjectURL(url);
}

function mergeOverride(
  previous: Record<string, RiskActionOverride>,
  caseId: string,
  next: Partial<RiskActionOverride>,
  newLog?: ReturnType<typeof buildManualRiskLog>,
) {
  const current = previous[caseId] ?? { extraLogs: [] };

  return {
    ...previous,
    [caseId]: {
      cardStatus: next.cardStatus ?? current.cardStatus,
      caseStatus: next.caseStatus ?? current.caseStatus,
      extraLogs: newLog ? [...current.extraLogs, newLog] : current.extraLogs,
    },
  };
}

export function RiskActionsPage() {
  const { dataset } = useMonitoringData();
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('todos');
  const [fraudFilter, setFraudFilter] = useState('todos');
  const [cardStatusFilter, setCardStatusFilter] = useState<CardStatusFilter>('todos');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('todos');
  const [cardQuery, setCardQuery] = useState('');
  const [overrides, setOverrides] = useState<Record<string, RiskActionOverride>>({});
  const [selectedId, setSelectedId] = useState('');

  const baseCases = useMemo(() => buildRiskActionCases(dataset), [dataset]);
  const cases = useMemo(
    () => baseCases.map((item) => applyRiskActionOverride(item, overrides[item.id])),
    [baseCases, overrides],
  );

  const fraudOptions = useMemo(
    () => ['todos', ...[...new Set(cases.flatMap((item) => item.fraudTypeLabels))].sort((left, right) => left.localeCompare(right))],
    [cases],
  );

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesRisk = riskFilter === 'todos' || item.riskLevel === riskFilter;
      const matchesFraud = fraudFilter === 'todos' || item.fraudTypeLabels.includes(fraudFilter);
      const matchesStatus = cardStatusFilter === 'todos' || item.cardStatus === cardStatusFilter;
      const matchesAction = actionFilter === 'todos' || item.executedActionTypes.includes(actionFilter);
      const matchesCard = !cardQuery || item.cardId.toLowerCase().includes(cardQuery.toLowerCase());

      return matchesRisk && matchesFraud && matchesStatus && matchesAction && matchesCard;
    });
  }, [actionFilter, cardQuery, cases, cardStatusFilter, fraudFilter, riskFilter]);

  const selectedCase = filteredCases.find((item) => item.id === selectedId) ?? filteredCases[0] ?? null;

  useEffect(() => {
    setOverrides({});
  }, [dataset]);

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedId('');
      return;
    }

    if (!filteredCases.some((item) => item.id === selectedId)) {
      setSelectedId(filteredCases[0].id);
    }
  }, [filteredCases, selectedId]);

  const criticalCases = cases.filter((item) => item.riskLevel === 'critico').length;
  const blockedCards = cases.filter((item) => item.cardStatus === 'bloqueado').length;
  const alertsSent = cases.filter((item) => item.executedActionTypes.includes('alerta')).length;
  const casesInAnalysis = cases.filter((item) => item.caseStatus === 'em_analise').length;

  const handleToggleBlock = (item: RiskActionCase) => {
    const isBlocked = item.cardStatus === 'bloqueado';
    const nextLog = buildManualRiskLog(item.cardId, isBlocked ? 'reativacao' : 'bloqueio');

    setOverrides((previous) =>
      mergeOverride(
        previous,
        item.id,
        {
          cardStatus: isBlocked ? 'ativo' : 'bloqueado',
          caseStatus: isBlocked ? item.caseStatus : 'em_analise',
        },
        nextLog,
      ),
    );
  };

  const handleSendAlert = (item: RiskActionCase) => {
    const alreadySentWhatsapp = item.actionTimeline.some((log) => log.type === 'alerta' && log.channel === 'whatsapp');
    const nextLog = buildManualRiskLog(item.cardId, 'alerta', false, alreadySentWhatsapp ? 'ligacao' : 'whatsapp');

    setOverrides((previous) => mergeOverride(previous, item.id, { caseStatus: 'em_analise' }, nextLog));
  };

  const handleEscalate = (item: RiskActionCase) => {
    const nextLog = buildManualRiskLog(item.cardId, 'analise_humana');
    setOverrides((previous) => mergeOverride(previous, item.id, { caseStatus: 'em_analise' }, nextLog));
  };

  const handleResolve = (item: RiskActionCase) => {
    const nextLog = buildManualRiskLog(item.cardId, 'resolvido');
    setOverrides((previous) => mergeOverride(previous, item.id, { caseStatus: 'resolvido' }, nextLog));
  };

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-line bg-gradient-to-r from-[#eef6ff] via-white to-[#fff8df] p-6">
        <PageHeader
          eyebrow="Centro de decisao"
          title="Acoes de risco"
          description="Priorize cartoes pelo score de risco, aplique acoes operacionais e mantenha um historico auditavel de bloqueios, alertas e encaminhamentos."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          title="Casos criticos"
          value={`${criticalCases}`}
          subtitle="Cartoes com score igual ou superior a 0,90."
          icon={<AlertTriangle size={22} />}
          tone="danger"
        />
        <CardResumo
          title="Cartoes bloqueados"
          value={`${blockedCards}`}
          subtitle="Bloqueios automaticos e manuais registrados."
          icon={<Lock size={22} />}
          tone="warning"
        />
        <CardResumo
          title="Alertas enviados"
          value={`${alertsSent}`}
          subtitle="WhatsApp ou ligacao simulada ao usuario."
          icon={<BellRing size={22} />}
        />
        <CardResumo
          title="Casos em analise"
          value={`${casesInAnalysis}`}
          subtitle="Itens encaminhados para revisao humana."
          icon={<SearchCheck size={22} />}
        />
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,260px)_minmax(0,220px)_minmax(0,240px)_minmax(0,240px)_auto] xl:items-end">
          <div className="space-y-2">
            <label htmlFor="risk-level-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Nivel de risco
            </label>
            <select
              id="risk-level-filter"
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              <option value="todos">Todos</option>
              <option value="critico">Critico</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="baixo">Baixo</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="risk-fraud-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Tipo de fraude
            </label>
            <select
              id="risk-fraud-filter"
              value={fraudFilter}
              onChange={(event) => setFraudFilter(event.target.value)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              {fraudOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'todos' ? 'Todos os tipos' : option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="risk-card-status-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Status do cartao
            </label>
            <select
              id="risk-card-status-filter"
              value={cardStatusFilter}
              onChange={(event) => setCardStatusFilter(event.target.value as CardStatusFilter)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="risk-action-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Acao executada
            </label>
            <select
              id="risk-action-filter"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value as ActionFilter)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              <option value="todos">Todas</option>
              <option value="monitoramento">Monitoramento</option>
              <option value="bloqueio">Bloqueio</option>
              <option value="alerta">Alerta enviado</option>
              <option value="analise_humana">Analise humana</option>
              <option value="resolvido">Resolvido</option>
              <option value="reativacao">Reativacao</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="risk-card-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Buscar cartao
            </label>
            <input
              id="risk-card-search"
              type="text"
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              placeholder="Ex.: C3010"
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => exportRiskActionsCsv(filteredCases)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent hover:bg-white"
          >
            <Download size={16} />
            Baixar CSV
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-slate-600">
          {filteredCases.length} caso{filteredCases.length === 1 ? '' : 's'} no recorte atual, sempre ordenados do maior score para o menor.
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <RiskActionsTable
          rows={filteredCases}
          selectedId={selectedId}
          onSelectCase={setSelectedId}
          onToggleBlock={handleToggleBlock}
          onSendAlert={handleSendAlert}
          onEscalate={handleEscalate}
          onResolve={handleResolve}
        />

        <section className="space-y-5">
          {selectedCase ? (
            <>
              <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cartao selecionado</p>
                    <h2 className="mt-2 text-2xl font-semibold text-panel">{selectedCase.cardId}</h2>
                  </div>
                  <RiskBadge level={selectedCase.riskLevel} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Score do modelo</p>
                    <p className="mt-2 text-2xl font-semibold text-panel">{selectedCase.score01.toFixed(2)}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedCase.scorePercent} pontos de 100</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status operacional</p>
                    <p className="mt-2 text-2xl font-semibold text-panel">{selectedCase.cardStatus}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedCase.caseStatus.replaceAll('_', ' ')}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Leitura do caso</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCase.latestReason}</p>
                </div>

                <div className="mt-5 rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Acao recomendada</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-panel">{selectedCase.recommendedAction}</p>
                </div>
              </article>

              <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-[#ffd0b0] bg-[#fff5ec] p-3 text-[#b84c00]">
                    <ShieldBan size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-panel">Justificativa da decisao</h3>
                    <p className="text-sm text-slate-600">Explicacao objetiva para apoiar a tomada de decisao do analista.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedCase.decisionJustification.map((item) => (
                    <div key={item} className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ultima transacao</p>
                    <p className="mt-2 text-sm font-semibold text-panel">{formatDateTime(selectedCase.lastTransactionDateTime)}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedCase.lastTransactionLocation}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Impacto estimado</p>
                    <p className="mt-2 text-sm font-semibold text-panel">{formatCurrency(selectedCase.estimatedFinancialLoss || 0)}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedCase.fraudTypeLabels.join(', ')}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-panel">Historico de acoes</h3>
                <p className="mt-1 text-sm text-slate-600">Trilha auditavel das decisoes automaticas e manuais do cartao.</p>

                <div className="mt-5 space-y-4">
                  {selectedCase.actionTimeline.length ? (
                    selectedCase.actionTimeline.map((log, index) => (
                      <div key={log.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="h-3 w-3 rounded-full bg-accent" />
                          {index < selectedCase.actionTimeline.length - 1 ? <div className="mt-2 h-full w-px bg-line" /> : null}
                        </div>
                        <div className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-panel">{formatDateTime(log.timestamp)}</span>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                log.automated ? 'bg-[#eef6ff] text-accent' : 'bg-[#fff5ec] text-[#b84c00]'
                              }`}
                            >
                              {log.automated ? 'Automatica' : 'Manual'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{log.description}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">{log.actor}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-10 text-center text-sm text-slate-500">
                      Nenhuma acao executada para este cartao ate o momento.
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-panel">Comunicacao simulada ao usuario</h3>
                <p className="mt-1 text-sm text-slate-600">Texto padrao usado pelo Notification Service no fluxo de seguranca.</p>
                <div className="mt-4 rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-4 text-sm leading-6 text-panel">
                  {buildNotificationMessage(selectedCase.cardId, selectedCase.cardStatus === 'bloqueado')}
                </div>
              </article>
            </>
          ) : (
            <article className="rounded-3xl border border-line bg-white px-5 py-16 text-center text-sm text-slate-500 shadow-sm">
              Nenhum caso disponivel para os filtros atuais.
            </article>
          )}
        </section>
      </div>
    </section>
  );
}
