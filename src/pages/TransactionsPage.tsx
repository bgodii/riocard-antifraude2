import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BadgeRisco } from '@/components/BadgeRisco';
import { Filtro } from '@/components/Filtro';
import { PageHeader } from '@/components/PageHeader';
import { TabelaDados, type TableColumn } from '@/components/TabelaDados';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import type { SuspiciousTransaction } from '@/types/transactions';
import { formatCurrency, formatDateTime } from '@/utils/format';

type ScoreFilter = 'todos' | '70' | '85';
type SortOrder = 'score_desc' | 'score_asc' | 'date_desc' | 'date_asc';

function prettifyFraudType(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function downloadTransactionsCsv(rows: SuspiciousTransaction[]) {
  const header = ['id_cartao', 'tipo_fraude', 'score_risco', 'nivel_risco', 'valor', 'localizacao', 'data_hora'];
  const body = rows.map((row) =>
    [
      row.cardId,
      row.fraudType,
      String(row.riskScore),
      row.riskLevel,
      String(row.amount),
      row.location,
      row.dateTime,
    ]
      .map((value) => escapeCsvValue(value))
      .join(','),
  );

  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'transacoes_suspeitas_filtradas.csv';
  link.click();

  URL.revokeObjectURL(url);
}

const columns: TableColumn<SuspiciousTransaction>[] = [
  { key: 'card', header: 'ID do cartao', render: (row) => <span className="font-semibold text-panel">{row.cardId}</span> },
  { key: 'fraudType', header: 'Tipo de fraude', render: (row) => row.fraudType },
  { key: 'score', header: 'Score de risco', render: (row) => <span>{row.riskScore}</span> },
  { key: 'amount', header: 'Valor', render: (row) => formatCurrency(row.amount) },
  { key: 'location', header: 'Localizacao', render: (row) => row.location },
  { key: 'datetime', header: 'Data/hora', render: (row) => formatDateTime(row.dateTime) },
  { key: 'risk', header: 'Nivel', render: (row) => <BadgeRisco level={row.riskLevel} /> },
];

export function TransactionsPage() {
  const { dataset } = useMonitoringData();
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('todos');
  const [sortOrder, setSortOrder] = useState<SortOrder>('score_desc');
  const [cardQuery, setCardQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('todos');

  const suspiciousTransactions = useMemo<SuspiciousTransaction[]>(() => {
    const transactionMap = new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]));

    return dataset.alerts.map((alert, index) => {
      const transaction = transactionMap.get(alert.transactionId);

      return {
        id: `${alert.id}-${index}`,
        cardId: alert.cardId,
        fraudType: prettifyFraudType(alert.fraudType),
        riskScore: alert.riskPoints,
        riskLevel: alert.riskScore,
        amount: transaction?.amount ?? alert.estimatedFinancialLoss ?? 0,
        location: alert.locationLabel,
        dateTime: alert.dateTime,
      };
    });
  }, [dataset.alerts, dataset.transactions]);

  const locationOptions = useMemo(
    () => ['todos', ...new Set(suspiciousTransactions.map((item) => item.location).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [suspiciousTransactions],
  );

  const filteredData = useMemo(() => {
    const filtered = suspiciousTransactions.filter((item) => {
      const matchesScore = scoreFilter === 'todos' || item.riskScore >= Number(scoreFilter);
      const matchesCard = !cardQuery || item.cardId.toLowerCase().includes(cardQuery.toLowerCase());
      const matchesLocation = locationFilter === 'todos' || item.location === locationFilter;

      return matchesScore && matchesCard && matchesLocation;
    });

    return filtered.sort((left, right) => {
      switch (sortOrder) {
        case 'score_asc':
          return left.riskScore - right.riskScore;
        case 'date_desc':
          return new Date(right.dateTime).getTime() - new Date(left.dateTime).getTime();
        case 'date_asc':
          return new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime();
        case 'score_desc':
        default:
          return right.riskScore - left.riskScore;
      }
    });
  }, [cardQuery, locationFilter, scoreFilter, sortOrder, suspiciousTransactions]);

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Score de risco"
        title="Transacoes suspeitas"
        description="Classifique cartoes por score antifraude, valor, localizacao e momento da ocorrencia para acelerar a triagem."
      />

      <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,280px)_minmax(0,280px)_minmax(0,220px)_auto] xl:items-end">
          <Filtro
            label="Filtro por score"
            value={scoreFilter}
            onChange={setScoreFilter}
            options={[
              { label: 'Todos', value: 'todos' },
              { label: '70+', value: '70' },
              { label: '85+', value: '85' },
            ]}
          />

          <div className="space-y-2">
            <label htmlFor="transactions-card-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Buscar cartao
            </label>
            <input
              id="transactions-card-search"
              type="text"
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              placeholder="Ex.: C3010"
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="transactions-location-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Filtrar local
            </label>
            <select
              id="transactions-location-filter"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              {locationOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'todos' ? 'Todos os locais' : option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="transactions-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ordenacao
            </label>
            <select
              id="transactions-sort"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              <option value="score_desc">Maior score para menor</option>
              <option value="score_asc">Menor score para maior</option>
              <option value="date_desc">Mais recente primeiro</option>
              <option value="date_asc">Mais antigo primeiro</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => downloadTransactionsCsv(filteredData)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] px-4 py-3 text-sm font-semibold text-accent transition hover:border-accent hover:bg-white"
          >
            <Download size={16} />
            Baixar CSV
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-slate-600">
          {filteredData.length} transacao{filteredData.length === 1 ? '' : 'es'} em observacao no recorte atual.
        </div>
      </div>

      <TabelaDados columns={columns} data={filteredData} />
    </section>
  );
}
