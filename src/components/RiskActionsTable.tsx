import { ActionButtons } from '@/components/ActionButtons';
import { RiskBadge } from '@/components/RiskBadge';
import type { RiskActionCase } from '@/types/riskActions';
import { formatDateTime } from '@/utils/format';

interface RiskActionsTableProps {
  rows: RiskActionCase[];
  selectedId: string;
  onSelectCase: (id: string) => void;
  onToggleBlock: (item: RiskActionCase) => void;
  onSendAlert: (item: RiskActionCase) => void;
  onEscalate: (item: RiskActionCase) => void;
  onResolve: (item: RiskActionCase) => void;
}

function truncateLabels(labels: string[]) {
  if (labels.length <= 2) {
    return labels.join(', ');
  }

  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

export function RiskActionsTable({
  rows,
  selectedId,
  onSelectCase,
  onToggleBlock,
  onSendAlert,
  onEscalate,
  onResolve,
}: RiskActionsTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-line bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
        Nenhum caso encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] divide-y divide-line">
          <thead className="bg-[#f4f8fc]">
            <tr>
              {[
                'Cartao',
                'Score do modelo',
                'Nivel',
                'Tipo de fraude',
                'Ultima transacao',
                'Status do cartao',
                'Acao recomendada',
                'Acao executada',
                'Acoes',
              ].map((header) => (
                <th key={header} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.map((item) => {
              const selected = item.id === selectedId;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectCase(item.id)}
                  className={`cursor-pointer align-top transition ${
                    selected ? 'bg-[#eef6ff]' : 'hover:bg-[#f8fbff]'
                  }`}
                >
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-panel">{item.cardId}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.alertsCount} alerta{item.alertsCount === 1 ? '' : 's'} | {item.transactionsCount} transacoes
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <p className="font-semibold text-panel">{item.score01.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.scorePercent} / 100</p>
                  </td>
                  <td className="px-4 py-4">
                    <RiskBadge level={item.riskLevel} />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{truncateLabels(item.fraudTypeLabels)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <p className="font-medium text-panel">{formatDateTime(item.lastTransactionDateTime)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.lastTransactionLocation}</p>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        item.cardStatus === 'bloqueado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.cardStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <p className="max-w-sm leading-6">{item.recommendedAction}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <p className="max-w-sm leading-6">{item.executedActionSummary}</p>
                  </td>
                  <td className="px-4 py-4">
                    <ActionButtons
                      item={item}
                      onToggleBlock={onToggleBlock}
                      onSendAlert={onSendAlert}
                      onEscalate={onEscalate}
                      onResolve={onResolve}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
