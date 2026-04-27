import type { RiskActionCase } from '@/types/riskActions';

interface ActionButtonsProps {
  item: RiskActionCase;
  onToggleBlock: (item: RiskActionCase) => void;
  onSendAlert: (item: RiskActionCase) => void;
  onEscalate: (item: RiskActionCase) => void;
  onResolve: (item: RiskActionCase) => void;
}

export function ActionButtons({ item, onToggleBlock, onSendAlert, onEscalate, onResolve }: ActionButtonsProps) {
  const disabled = item.caseStatus === 'resolvido';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleBlock(item);
        }}
        className="rounded-xl border border-[#b7d6f5] bg-white px-3 py-2 text-xs font-semibold text-panel transition hover:border-accent hover:bg-[#eef6ff]"
      >
        {item.cardStatus === 'bloqueado' ? 'Reativar cartao' : 'Bloquear cartao'}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onSendAlert(item);
        }}
        className="rounded-xl border border-[#ffd0b0] bg-[#fff5ec] px-3 py-2 text-xs font-semibold text-[#b84c00] transition hover:border-[#ff6a00] hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        Enviar alerta
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onEscalate(item);
        }}
        className="rounded-xl border border-[#b7d6f5] bg-[#eef6ff] px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        Analise humana
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onResolve(item);
        }}
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        Marcar resolvido
      </button>
    </div>
  );
}
