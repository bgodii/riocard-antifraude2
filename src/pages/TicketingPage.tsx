import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Ticket } from 'lucide-react';
import { GraficoLinha } from '@/components/GraficoLinha';
import { PageHeader } from '@/components/PageHeader';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import { ticketingFrauds } from '@/services/ticketing';
import type { FraudAlert, TransactionRecord } from '@/types/fraud';
import type { TicketingFraudEvent } from '@/types/ticketing';
import { formatCurrency, formatDateTime } from '@/utils/format';

type TicketingEventView = TicketingFraudEvent & {
  categories?: string[];
  relatedAlerts?: FraudAlert[];
  relatedTransactions?: TransactionRecord[];
  source: 'dataset' | 'mock';
};

const ticketingFraudTypes = new Set([
  'multi validacao sequencial',
  'uso gratuidade indevida',
  'clonagem de cartao',
]);

function prettifyFraudType(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUsageSeries(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const alertByTransactionId = new Map(alerts.map((alert) => [alert.transactionId, alert]));

  return transactions
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((transaction) => {
      const matchingAlert = alertByTransactionId.get(transaction.id);

      return {
        time: new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(transaction.dateTime)),
        uses: matchingAlert?.riskPoints ?? transaction.modelRiskScore ?? transaction.baseRiskScore ?? 0,
      };
    });
}

export function TicketingPage() {
  const { dataset } = useMonitoringData();
  const [selectedFraud, setSelectedFraud] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [selectedTableCategory, setSelectedTableCategory] = useState('');

  const derivedEvents = useMemo<TicketingEventView[]>(() => {
    const relevantAlerts = dataset.alerts.filter((alert) => ticketingFraudTypes.has(alert.fraudType));
    const transactionsById = new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]));
    const grouped = new Map<string, FraudAlert[]>();

    for (const alert of relevantAlerts) {
      const key = alert.cardId;
      const collection = grouped.get(key) ?? [];
      collection.push(alert);
      grouped.set(key, collection);
    }

    const events = [...grouped.entries()].map(([key, alerts], index) => {
      const cardId = key;
      const relatedTransactions = [
        ...new Map(
          alerts
            .map((alert) => transactionsById.get(alert.transactionId))
            .filter((transaction): transaction is TransactionRecord => Boolean(transaction))
            .map((transaction) => [transaction.id, transaction]),
        ).values(),
      ]
        .sort((left, right) => left.timestamp - right.timestamp);

      const averageRisk = alerts.reduce((sum, alert) => sum + alert.riskPoints, 0) / alerts.length;
      const categories = [...new Set(alerts.map((alert) => prettifyFraudType(alert.fraudType)))].sort((left, right) =>
        left.localeCompare(right),
      );

      return {
        id: `BT-D-${index + 1}`,
        cardId,
        fraudType: categories[0] ?? 'Bilhetagem suspeita',
        anomalousFrequency: Number(Math.max(1.2, averageRisk / 20).toFixed(1)),
        occurrences: alerts.length,
        usageSeries: buildUsageSeries(relatedTransactions, alerts),
        categories,
        relatedAlerts: alerts.sort((left, right) => right.timestamp - left.timestamp),
        relatedTransactions: relatedTransactions.sort((left, right) => right.timestamp - left.timestamp),
        source: 'dataset' as const,
      };
    });

    return events.sort((left, right) => right.occurrences - left.occurrences);
  }, [dataset.alerts, dataset.transactions]);

  const events = derivedEvents.length
    ? derivedEvents
    : ticketingFrauds.map((event) => ({
        ...event,
        source: 'mock' as const,
        relatedAlerts: [],
        relatedTransactions: [],
      }));

  const fraudOptions = useMemo(
    () =>
      [
        ...new Set(
          events.flatMap((event) => event.categories ?? [event.fraudType]),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [events],
  );

  const fraudFilteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesFraud =
        !selectedFraud ||
        (event.categories ?? [event.fraudType]).some((category) => category.toLowerCase() === selectedFraud.toLowerCase());

      return matchesFraud;
    });
  }, [events, selectedFraud]);

  const cardOptions = useMemo(
    () => fraudFilteredEvents.map((event) => event.cardId).sort((left, right) => left.localeCompare(right)),
    [fraudFilteredEvents],
  );

  const filteredEvents = useMemo(() => {
    return fraudFilteredEvents.filter((event) => {
      const matchesSelectedCard = !selectedCard || event.cardId === selectedCard;
      const matchesTypedCard = !cardQuery || event.cardId.toLowerCase().includes(cardQuery.toLowerCase());

      return matchesSelectedCard && matchesTypedCard;
    });
  }, [cardQuery, fraudFilteredEvents, selectedCard]);

  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');

  useEffect(() => {
    if (!selectedFraud && fraudOptions.length) {
      setSelectedFraud(fraudOptions[0]);
    }
  }, [fraudOptions, selectedFraud]);

  useEffect(() => {
    setSelectedCard('');
  }, [selectedFraud]);

  useEffect(() => {
    setSelectedId(filteredEvents[0]?.id ?? '');
  }, [filteredEvents]);

  const selectedEvent = filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0];
  const filteredTransactions = useMemo(() => {
    if (!selectedEvent?.relatedTransactions?.length) {
      return [];
    }

    if (!selectedTableCategory) {
      return selectedEvent.relatedTransactions;
    }

    return selectedEvent.relatedTransactions.filter((transaction) => {
      const matchingAlert = selectedEvent.relatedAlerts?.find((alert) => alert.transactionId === transaction.id);
      return matchingAlert ? prettifyFraudType(matchingAlert.fraudType) === selectedTableCategory : false;
    });
  }, [selectedEvent, selectedTableCategory]);

  useEffect(() => {
    setSelectedTableCategory('');
  }, [selectedId, selectedFraud]);

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Bilhetagem"
        title="Fraude por bilhetagem"
        description="Selecione o tipo de fraude e veja a lista de cartoes impactados, com os alertas consolidados em um unico quadro por cartao."
      />

      <div className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,260px)_minmax(0,280px)_minmax(0,260px)_1fr]">
        <div className="space-y-2">
          <label htmlFor="ticketing-fraud-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tipo de fraude
          </label>
          <select
            id="ticketing-fraud-filter"
            value={selectedFraud}
            onChange={(event) => setSelectedFraud(event.target.value)}
            className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
          >
            {fraudOptions.map((fraudType) => (
              <option key={fraudType} value={fraudType}>
                {fraudType}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="ticketing-card-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Selecionar cartao
          </label>
          <select
            id="ticketing-card-filter"
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

        <div className="space-y-2">
          <label htmlFor="ticketing-card-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Digitar cartao
          </label>
          <input
            id="ticketing-card-search"
            type="text"
            value={cardQuery}
            onChange={(event) => setCardQuery(event.target.value)}
            placeholder="Ex.: C3010"
            className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
          />
        </div>

        <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] px-4 py-4 text-sm text-slate-600">
          <p className="font-semibold text-panel">
            {filteredEvents.length} cartao{filteredEvents.length === 1 ? '' : 'es'} encontrado{filteredEvents.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1">
            A lista abaixo mostra os cartoes com ocorrencias de <span className="font-semibold">{selectedFraud || 'fraude selecionada'}</span>
            {selectedCard ? (
              <>
                {' '}
                e filtrados pelo cartao <span className="font-semibold">{selectedCard}</span>
              </>
            ) : null}
            {cardQuery ? (
              <>
                {' '}
                com busca por <span className="font-semibold">{cardQuery}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`mt-2 text-xl font-semibold ${selected ? 'text-white' : 'text-panel'}`}>{event.cardId}</h3>
                    <p className={`mt-2 text-xs uppercase tracking-[0.18em] ${selected ? 'text-sky-100' : 'text-slate-500'}`}>
                      {(event.categories ?? [event.fraudType]).join(' • ')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      selected ? 'bg-white/15 text-white' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {event.occurrences} alertas
                  </span>
                </div>
                <p className={`mt-3 text-sm ${selected ? 'text-sky-50' : 'text-slate-600'}`}>
                  {event.occurrences} ocorrencias consolidadas para este cartao dentro da fraude {selectedFraud || event.fraudType}, com frequencia anomala {event.anomalousFrequency}x acima do comportamento esperado.
                </p>
                <p className={`mt-2 text-xs ${selected ? 'text-sky-100/80' : 'text-slate-500'}`}>
                  Clique para ver as transacoes relacionadas.
                </p>
              </button>
            );
          })}

          {!filteredEvents.length ? (
            <div className="rounded-3xl border border-line bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
              Nenhum cartao encontrado para o filtro informado.
            </div>
          ) : null}
        </div>

        <section className="space-y-6">
          {selectedEvent ? (
            <>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-panel">Score por transacao</h2>
                <p className="text-sm text-slate-600">
                  Evolucao da intensidade de risco para o cartao {selectedEvent.cardId}, considerando a fraude {selectedFraud || selectedEvent.fraudType}.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <Ticket size={14} />
                {selectedEvent.source === 'dataset' ? 'Base carregada' : 'Mock'}
              </div>
            </div>

            <GraficoLinha key={selectedEvent.id} data={selectedEvent.usageSeries} xKey="time" yKey="uses" color="#0454a3" />
          </div>

          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl border border-[#ffd768] bg-[#fff8df] p-3 text-panel">
                <AlertCircle size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-panel">Transacoes apontadas</h3>
                <p className="text-sm text-slate-600">
                  Lista consolidada das transacoes relacionadas ao cartao selecionado para a fraude escolhida.
                </p>
              </div>
            </div>

            {selectedEvent.categories?.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTableCategory('')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    !selectedTableCategory
                      ? 'border-panel bg-panel text-white'
                      : 'border-[#b7d6f5] bg-[#eef6ff] text-accent hover:border-accent'
                  }`}
                >
                  Todas
                </button>
                {selectedEvent.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedTableCategory(category)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      selectedTableCategory === category
                        ? 'border-panel bg-panel text-white'
                        : 'border-[#b7d6f5] bg-[#eef6ff] text-accent hover:border-accent'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}

            {filteredTransactions.length ? (
              <div className="overflow-hidden rounded-3xl border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line">
                    <thead className="bg-[#f4f8fc]">
                      <tr>
                        {['Transacao', 'Data/hora', 'Local', 'Transporte', 'Categoria', 'Valor', 'Score'].map((header) => (
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
                      {filteredTransactions.map((transaction) => {
                        const matchingAlert = selectedEvent.relatedAlerts?.find((alert) => alert.transactionId === transaction.id);

                        return (
                          <tr key={transaction.id} className="hover:bg-[#f8fbff]">
                            <td className="px-4 py-3 text-sm font-medium text-panel">
                              {transaction.externalTransactionId || transaction.id}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(transaction.dateTime)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{transaction.locationLabel}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{transaction.transportType || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {matchingAlert ? prettifyFraudType(matchingAlert.fraudType) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {formatCurrency(transaction.amount ?? transaction.estimatedFinancialLoss ?? 0)}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{matchingAlert?.riskPoints ?? transaction.modelRiskScore ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-line bg-[#f8fbff] px-4 py-10 text-center text-sm text-slate-500">
                Nenhuma transacao encontrada para a categoria selecionada.
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="rounded-3xl border border-line bg-white px-5 py-16 text-center text-sm text-slate-500 shadow-sm">
              Selecione um cartao para visualizar o grafico e as transacoes relacionadas.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
