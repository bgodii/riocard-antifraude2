import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import { cardSharingEvents } from '@/services/sharing';
import type { FraudAlert, TransactionRecord } from '@/types/fraud';
import type { CardSharingEvent, CardSharingTimelineEvent } from '@/types/sharing';
import { formatDateTime } from '@/utils/format';

type SharingEventView = CardSharingEvent & {
  source: 'dataset' | 'mock';
  relatedAlerts?: FraudAlert[];
  relatedTransactions?: TransactionRecord[];
};

function buildTimeline(transactions: TransactionRecord[]): CardSharingTimelineEvent[] {
  return transactions
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((transaction, index) => ({
      time: new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(transaction.dateTime)),
      location: transaction.locationLabel,
      action: index === 0 ? 'Validacao inicial' : 'Uso subsequente',
    }));
}

export function CardSharingPage() {
  const { dataset } = useMonitoringData();
  const [selectedCard, setSelectedCard] = useState('');

  const derivedEvents = useMemo<SharingEventView[]>(() => {
    const relevantAlerts = dataset.alerts.filter((alert) => alert.fraudType === 'compartilhamento');
    const transactionsById = new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]));
    const grouped = new Map<string, FraudAlert[]>();

    for (const alert of relevantAlerts) {
      const collection = grouped.get(alert.cardId) ?? [];
      collection.push(alert);
      grouped.set(alert.cardId, collection);
    }

    return [...grouped.entries()]
      .map(([cardId, alerts], index) => {
        const relatedTransactions = [
          ...new Map(
            alerts
              .flatMap((alert) => alert.relatedTransactionIds)
              .map((transactionId) => transactionsById.get(transactionId))
              .filter((transaction): transaction is TransactionRecord => Boolean(transaction))
              .map((transaction) => [transaction.id, transaction]),
          ).values(),
        ].sort((left, right) => left.timestamp - right.timestamp);

        const intervals = relatedTransactions.slice(1).map((transaction, currentIndex) => {
          const previous = relatedTransactions[currentIndex];
          return Math.max(1, Math.round((transaction.timestamp - previous.timestamp) / 60000));
        });

        const simultaneousLocations = [...new Set(relatedTransactions.map((transaction) => transaction.locationLabel))];
        const intervalMinutes = intervals.length ? Math.min(...intervals) : 0;
        const estimatedUsers =
          relatedTransactions.length > 1 || simultaneousLocations.length > 1 ? Math.max(2, simultaneousLocations.length) : 1;

        return {
          id: `CP-D-${index + 1}`,
          cardId,
          estimatedUsers,
          intervalMinutes,
          simultaneousLocations,
          timeline: buildTimeline(relatedTransactions),
          source: 'dataset' as const,
          relatedAlerts: alerts.sort((left, right) => right.timestamp - left.timestamp),
          relatedTransactions: relatedTransactions.sort((left, right) => right.timestamp - left.timestamp),
        };
      })
      .sort((left, right) => right.estimatedUsers - left.estimatedUsers || left.intervalMinutes - right.intervalMinutes);
  }, [dataset.alerts, dataset.transactions]);

  const events = derivedEvents.length
    ? derivedEvents
    : cardSharingEvents.map((event) => ({
        ...event,
        source: 'mock' as const,
        relatedAlerts: [],
        relatedTransactions: [],
      }));

  const cardOptions = useMemo(
    () => events.map((event) => event.cardId).sort((left, right) => left.localeCompare(right)),
    [events],
  );

  const filteredEvents = useMemo(() => {
    if (!selectedCard) {
      return events;
    }

    return events.filter((event) => event.cardId === selectedCard);
  }, [events, selectedCard]);

  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');

  useEffect(() => {
    setSelectedId(filteredEvents[0]?.id ?? '');
  }, [filteredEvents]);

  const selectedEvent = filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0];

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Compartilhamento"
        title="Compartilhamento de cartoes"
        description="Detecte usos simultaneos em locais incompativeis e estime quantos usuarios estao dividindo o mesmo cartao."
      />

      <div className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-2">
          <label htmlFor="sharing-card-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Selecionar cartao
          </label>
          <select
            id="sharing-card-filter"
            value={selectedCard}
            onChange={(event) => setSelectedCard(event.target.value)}
            className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
          >
            <option value="">Todos os cartoes</option>
            {cardOptions.map((cardId) => (
              <option key={cardId} value={cardId}>
                {cardId}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] px-4 py-4 text-sm text-slate-600">
          <p className="font-semibold text-panel">
            {filteredEvents.length} cartao{filteredEvents.length === 1 ? '' : 'es'} encontrado{filteredEvents.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1">
            A lista abaixo mostra {selectedCard ? <>apenas o cartao <span className="font-semibold">{selectedCard}</span></> : 'todos os cartoes com suspeita de compartilhamento'}.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const selected = selectedEvent?.id === event.id;

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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.18em] ${selected ? 'text-sky-100' : 'text-slate-500'}`}>Cartao</p>
                    <h3 className={`mt-2 text-xl font-semibold ${selected ? 'text-white' : 'text-panel'}`}>{event.cardId}</h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      selected ? 'bg-white/15 text-white' : 'bg-[#fff8df] text-panel'
                    }`}
                  >
                    {event.estimatedUsers} {event.estimatedUsers === 1 ? 'usuario estimado' : 'usuarios estimados'}
                  </span>
                </div>
                <p className={`mt-3 text-sm ${selected ? 'text-sky-50' : 'text-slate-600'}`}>
                  {event.simultaneousLocations.length
                    ? `Intervalo minimo de ${event.intervalMinutes} min entre usos em ${event.simultaneousLocations.join(' e ')}.`
                    : 'Nao ha locais suficientes para detalhar o compartilhamento.'}
                </p>
              </button>
            );
          })}

          {!filteredEvents.length ? (
            <div className="rounded-3xl border border-line bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
              Nenhum cartao encontrado para o filtro selecionado.
            </div>
          ) : null}
        </div>

        <section className="space-y-6">
          {selectedEvent ? (
            <>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-panel">Linha do tempo de uso</h2>
                <p className="text-sm text-slate-600">Sequencia operacional registrada para {selectedEvent.cardId}.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <Users size={14} />
                {selectedEvent.source === 'dataset' ? 'Base carregada' : 'Mock'}
              </div>
            </div>

            <div className="space-y-4">
              {selectedEvent.timeline.map((item, index) => (
                <div key={`${item.time}-${item.location}-${index}`} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-brandSun" />
                    {index < selectedEvent.timeline.length - 1 ? <div className="mt-2 h-full w-px bg-line" /> : null}
                  </div>
                  <div className="rounded-2xl border border-line bg-[#f8fbff] px-4 py-3">
                    <p className="text-sm font-semibold text-panel">
                      {item.time} · {item.location}
                    </p>
                    <p className="text-sm text-slate-600">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedEvent.relatedTransactions?.length ? (
            <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-panel">Transacoes relacionadas</h3>
              <p className="mt-1 text-sm text-slate-600">Ocorrencias utilizadas para montar este caso de compartilhamento.</p>

              <div className="mt-4 overflow-hidden rounded-3xl border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line">
                    <thead className="bg-[#f4f8fc]">
                      <tr>
                        {['Transacao', 'Data/hora', 'Local', 'Transporte', 'Score'].map((header) => (
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
                            <td className="px-4 py-3 text-sm text-slate-600">{matchingAlert?.riskPoints ?? transaction.modelRiskScore ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
            </>
          ) : (
            <div className="rounded-3xl border border-line bg-white px-5 py-16 text-center text-sm text-slate-500 shadow-sm">
              Selecione um cartao para visualizar a linha do tempo e as transacoes relacionadas.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
