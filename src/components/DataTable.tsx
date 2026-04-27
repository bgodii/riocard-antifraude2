import { ArrowDown, ArrowUp } from 'lucide-react';
import { FraudTypeBadge, RiskBadge } from '@/components/FraudBadge';
import type { FraudAlert, SortState } from '@/types/fraud';

interface DataTableProps {
  alerts: FraudAlert[];
  page: number;
  pageSize: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onPageChange: (page: number) => void;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SortButton({
  label,
  column,
  sort,
  onSortChange,
}: {
  label: string;
  column: SortState['column'];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  const active = sort.column === column;

  return (
    <button
      type="button"
      onClick={() =>
        onSortChange({
          column,
          direction: active && sort.direction === 'desc' ? 'asc' : 'desc',
        })
      }
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-panel"
    >
      {label}
      {active ? (sort.direction === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />) : null}
    </button>
  );
}

export function DataTable({ alerts, page, pageSize, sort, onSortChange, onPageChange }: DataTableProps) {
  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const start = (page - 1) * pageSize;
  const currentRows = alerts.slice(start, start + pageSize);

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-[#f4f8fc]">
              <tr>
                <th className="px-4 py-3">
                  <SortButton label="ID do cartao" column="cardId" sort={sort} onSortChange={onSortChange} />
                </th>
                <th className="px-4 py-3">
                  <SortButton label="Data/hora" column="dateTime" sort={sort} onSortChange={onSortChange} />
                </th>
                <th className="px-4 py-3">
                  <SortButton label="Local" column="locationLabel" sort={sort} onSortChange={onSortChange} />
                </th>
                <th className="px-4 py-3">
                  <SortButton label="Tipo de fraude" column="fraudType" sort={sort} onSortChange={onSortChange} />
                </th>
                <th className="px-4 py-3">
                  <SortButton label="Score" column="riskScore" sort={sort} onSortChange={onSortChange} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Motivo
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line bg-white">
              {currentRows.length ? (
                currentRows.map((alert) => (
                  <tr key={alert.id} className="align-top hover:bg-[#f8fbff]">
                    <td className="px-4 py-4 text-sm font-medium text-panel">{alert.cardId}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(alert.dateTime)}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{alert.locationLabel}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <FraudTypeBadge value={alert.fraudType} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <div className="flex flex-col gap-2">
                        <RiskBadge value={alert.riskScore} />
                        <span className="text-xs text-slate-500">{alert.riskPoints}/100</span>
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-4 text-sm leading-6 text-slate-600">{alert.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Nenhum alerta encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Mostrando <span className="font-medium text-panel">{currentRows.length}</span> de{' '}
          <span className="font-medium text-panel">{alerts.length}</span> alertas.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-2xl border border-line bg-white px-4 py-2 text-sm text-panel transition hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-2xl border border-line bg-white px-4 py-2 text-sm text-panel transition hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
}
