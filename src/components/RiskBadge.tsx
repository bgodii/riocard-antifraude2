import clsx from 'clsx';
import type { RiskCriticality } from '@/types/riskActions';

const badgeStyles: Record<RiskCriticality, string> = {
  baixo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medio: 'border-amber-200 bg-amber-50 text-amber-800',
  alto: 'border-rose-200 bg-rose-50 text-rose-700',
  critico: 'border-slate-900 bg-slate-900 text-white',
};

const badgeLabels: Record<RiskCriticality, string> = {
  baixo: 'Baixo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Critico',
};

export function RiskBadge({ level }: { level: RiskCriticality }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        badgeStyles[level],
      )}
    >
      {badgeLabels[level]}
    </span>
  );
}
