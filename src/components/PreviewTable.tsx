import type { TransactionRecord } from '@/types/fraud';

interface PreviewTableProps {
  rows: TransactionRecord[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function PreviewTable({ rows }: PreviewTableProps) {
  return (
    <div className="mt-5 overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-[#f4f8fc]">
            <tr>
              {['Cartao', 'Data/hora', 'Local', 'Transporte', 'Valor'].map((header) => (
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
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm font-medium text-panel">{row.cardId}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(row.dateTime)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.locationLabel}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.transportType || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.amount !== null ? `R$ ${row.amount.toFixed(2)}` : '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhuma transacao disponivel para preview.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
