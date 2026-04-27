import { useEffect, useMemo, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { GraficoLinha } from '@/components/GraficoLinha';
import { PageHeader } from '@/components/PageHeader';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import { informalSalesEvents } from '@/services/informalSales';
import type { FraudAlert, TransactionRecord } from '@/types/fraud';
import type { InformalSaleEvent } from '@/types/informalSales';
import {
  isSuspiciousResaleWindow,
  REVENDA_MAX_WINDOW_MINUTES,
  REVENDA_MIN_TRANSACTIONS,
} from '@/utils/fraudDetection';
import { formatCurrency, formatDateTime } from '@/utils/format';

type InformalSalesEventView = InformalSaleEvent & {
  source: 'dataset' | 'mock';
  signalType: 'janela operacional' | 'sinal da planilha' | 'hibrido';
  relatedAlerts?: FraudAlert[];
  relatedTransactions?: TransactionRecord[];
  rationale: string;
};

const CLUSTER_GAP_MINUTES = 20;

function buildVolumeSeries(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const alertByTransactionId = new Map(alerts.map((alert) => [alert.transactionId, alert]));

  return transactions
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((transaction) => ({
      time: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(transaction.dateTime)),
      volume: alertByTransactionId.get(transaction.id)?.riskPoints ?? transaction.modelRiskScore ?? transaction.baseRiskScore ?? 0,
    }));
}

function clusterAlerts(alerts: FraudAlert[]) {
  const sortedAlerts = [...alerts].sort((left, right) => left.timestamp - right.timestamp);
  const clusters: FraudAlert[][] = [];

  for (const alert of sortedAlerts) {
    const lastCluster = clusters.at(-1);
    const lastAlert = lastCluster?.at(-1);

    if (!lastCluster || !lastAlert) {
      clusters.push([alert]);
      continue;
    }

    const diffMinutes = (alert.timestamp - lastAlert.timestamp) / 60000;

    if (diffMinutes <= CLUSTER_GAP_MINUTES) {
      lastCluster.push(alert);
    } else {
      clusters.push([alert]);
    }
  }

  return clusters;
}

export function InformalSalesPage() {
  const { dataset } = useMonitoringData();

  const derivedEvents = useMemo<InformalSalesEventView[]>(() => {
    const relevantAlerts = dataset.alerts.filter((alert) => alert.fraudType === 'revenda');
    const transactionsById = new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]));
    const alertsByCard = new Map<string, FraudAlert[]>();

    for (const alert of relevantAlerts) {
      const collection = alertsByCard.get(alert.cardId) ?? [];
      collection.push(alert);
      alertsByCard.set(alert.cardId, collection);
    }

    return [...alertsByCard.entries()]
      .flatMap(([cardId, alerts]) =>
        clusterAlerts(alerts).flatMap((cluster, clusterIndex) => {
          const relatedTransactions = [
            ...new Map(
              cluster
                .flatMap((alert) => alert.relatedTransactionIds)
                .map((transactionId) => transactionsById.get(transactionId))
                .filter((transaction): transaction is TransactionRecord => Boolean(transaction))
                .map((transaction) => [transaction.id, transaction]),
            ).values(),
          ].sort((left, right) => left.timestamp - right.timestamp);

          if (!relatedTransactions.length) {
            return [];
          }

          const hasOperationalWindow = isSuspiciousResaleWindow(relatedTransactions);
          const hasNativeSignal = cluster.some((alert) => alert.source === 'planilha' || alert.source === 'hibrido');

          if (!hasOperationalWindow && !hasNativeSignal) {
            return [];
          }

          const firstTransaction = relatedTransactions[0];
          const lastTransaction = relatedTransactions.at(-1)!;
          const windowMinutes = Math.max(1, Math.round((lastTransaction.timestamp - firstTransaction.timestamp) / 60000));

          if (hasOperationalWindow && windowMinutes > REVENDA_MAX_WINDOW_MINUTES) {
            return [];
          }

          const estimatedValue = relatedTransactions.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0);
          const signalType: InformalSalesEventView['signalType'] =
            hasOperationalWindow && hasNativeSignal ? 'hibrido' : hasOperationalWindow ? 'janela operacional' : 'sinal da planilha';
          const rationale = hasOperationalWindow
            ? `${relatedTransactions.length} passagens em ${windowMinutes} minutos na regiao de ${firstTransaction.locationLabel}.`
            : `${cluster.length} ocorrencia${cluster.length === 1 ? '' : 's'} de revenda sinalizada${cluster.length === 1 ? '' : 's'} pela planilha para o cartao ${cardId}.`;

          return [
            {
              id: `VI-D-${cardId}-${clusterIndex + 1}`,
              cardId,
              transactionCount: relatedTransactions.length,
              station: firstTransaction.locationLabel,
              windowMinutes,
              estimatedValue,
              volumeSeries: buildVolumeSeries(relatedTransactions, cluster),
              source: 'dataset' as const,
              signalType,
              relatedAlerts: [...cluster].sort((left, right) => right.timestamp - left.timestamp),
              relatedTransactions: [...relatedTransactions].sort((left, right) => right.timestamp - left.timestamp),
              rationale,
            },
          ];
        }),
      )
      .sort((left, right) => {
        const leftPriority = left.signalType === 'janela operacional' || left.signalType === 'hibrido' ? 1 : 0;
        const rightPriority = right.signalType === 'janela operacional' || right.signalType === 'hibrido' ? 1 : 0;

        return rightPriority - leftPriority || right.transactionCount - left.transactionCount || left.windowMinutes - right.windowMinutes;
      });
  }, [dataset.alerts, dataset.transactions]);

  const hasUploadedDataset = dataset.transactions.length > 0;
  const impossibleDisplacementCount = useMemo(
    () => dataset.alerts.filter((alert) => alert.fraudType === 'deslocamento impossivel').length,
    [dataset.alerts],
  );

  const events = hasUploadedDataset
    ? derivedEvents
    : informalSalesEvents.map((event) => ({
        ...event,
        source: 'mock' as const,
        signalType: 'janela operacional' as const,
        relatedAlerts: [],
        relatedTransactions: [],
        rationale: `${event.transactionCount} passagens em ${event.windowMinutes} minutos.`,
      }));

  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');

  useEffect(() => {
    setSelectedId(events[0]?.id ?? '');
  }, [events]);

  const selectedEvent = events.find((event) => event.id === selectedId) ?? events[0] ?? null;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Revenda"
        title="Vendas informais"
        description="Esta aba consolida dois sinais: janelas operacionais realmente atipicas e casos de revenda ja marcados pela planilha carregada."
      />

      {hasUploadedDataset ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Casos exibidos nesta aba</p>
            <p className="mt-2 text-3xl font-semibold text-panel">{events.length}</p>
            <p className="mt-2 text-sm text-slate-600">Revenda consolidada por cartao, a partir da base carregada.</p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Janelas operacionais</p>
            <p className="mt-2 text-3xl font-semibold text-panel">
              {events.filter((event) => event.signalType === 'janela operacional' || event.signalType === 'hibrido').length}
            </p>
            <p className="mt-2 text-sm text-slate-600">Casos com concentracao compativel com revenda operacional.</p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Deslocamento impossivel</p>
            <p className="mt-2 text-3xl font-semibold text-panel">{impossibleDisplacementCount}</p>
            <p className="mt-2 text-sm text-slate-600">Esse tipo existe na base, mas pertence a outro modelo e nao a revenda.</p>
          </div>
        </div>
      ) : null}

      {events.length && selectedEvent ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            {events.map((event) => {
              const selected = selectedEvent.id === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedId(event.id)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    selected
                      ? 'border-panel bg-panel text-white shadow-lg shadow-sky-200/60'
                      : 'border-line bg-white text-slate-700 shadow-sm hover:border-accent hover:bg-[#f8fbff]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.18em] ${selected ? 'text-sky-100' : 'text-slate-500'}`}>{event.station}</p>
                      <h3 className={`mt-2 text-xl font-semibold ${selected ? 'text-white' : 'text-panel'}`}>{event.cardId}</h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        selected ? 'bg-white/15 text-white' : 'bg-[#fff8df] text-panel'
                      }`}
                    >
                      {event.transactionCount} transacoes
                    </span>
                  </div>
                  <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.18em] ${selected ? 'text-sky-100' : 'text-accent'}`}>
                    {event.signalType}
                  </p>
                  <p className={`mt-3 text-sm ${selected ? 'text-sky-50' : 'text-slate-600'}`}>{event.rationale}</p>
                  <p className={`mt-2 text-sm ${selected ? 'text-sky-50' : 'text-slate-600'}`}>
                    Valor estimado: {formatCurrency(event.estimatedValue)}.
                  </p>
                </button>
              );
            })}
          </div>

          <section className="space-y-6">
            <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-panel">Score por transacao</h2>
                  <p className="text-sm text-slate-600">
                    Detalhamento das transacoes ligadas ao cartao {selectedEvent.cardId} para o sinal de revenda selecionado.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  <ScanSearch size={14} />
                  {selectedEvent.source === 'dataset' ? 'Base carregada' : 'Mock'}
                </div>
              </div>
              <GraficoLinha key={selectedEvent.id} data={selectedEvent.volumeSeries} xKey="time" yKey="volume" color="#d97706" />
            </div>

            {selectedEvent.relatedTransactions?.length ? (
              <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-panel">Transacoes relacionadas</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Ocorrencias usadas para compor o caso selecionado, seja por janela operacional ou por sinalizacao da planilha.
                </p>

                <div className="mt-4 overflow-hidden rounded-3xl border border-line">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-line">
                      <thead className="bg-[#f4f8fc]">
                        <tr>
                          {['Transacao', 'Data/hora', 'Local', 'Transporte', 'Valor', 'Score', 'Origem'].map((header) => (
                            <th
                              key={header}
                              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-white">
                        {selectedEvent.relatedTransactions.map((transaction) => {
                          const matchingAlert = selectedEvent.relatedAlerts?.find((alert) => alert.transactionId === transaction.id);

                          return (
                            <tr key={transaction.id} className="hover:bg-[#f8fbff]">
                              <td className="px-4 py-3 text-sm font-medium text-panel">{transaction.externalTransactionId || transaction.id}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(transaction.dateTime)}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{transaction.locationLabel}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{transaction.transportType || '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(transaction.amount ?? 0)}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{matchingAlert?.riskPoints ?? transaction.modelRiskScore ?? '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{matchingAlert?.source ?? '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <section className="rounded-3xl border border-line bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-panel">Nenhum caso de revenda exibivel</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            A base atual nao trouxe nem janelas operacionais com pelo menos {REVENDA_MIN_TRANSACTIONS} validacoes em ate{' '}
            {REVENDA_MAX_WINDOW_MINUTES} minutos no mesmo ponto de uso, nem registros de revenda sinalizados pela planilha.
          </p>
          {impossibleDisplacementCount ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Ainda assim, a base possui {impossibleDisplacementCount} caso{impossibleDisplacementCount === 1 ? '' : 's'} de
              deslocamento impossivel em outro modulo.
            </p>
          ) : null}
        </section>
      )}
    </section>
  );
}
