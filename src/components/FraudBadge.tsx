import clsx from 'clsx';
import type { FraudType, RiskScore } from '@/types/fraud';

export function RiskBadge({ value }: { value: RiskScore }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        value === 'alto' && 'bg-rose-100 text-rose-700',
        value === 'medio' && 'bg-amber-100 text-amber-700',
        value === 'baixo' && 'bg-emerald-100 text-emerald-700',
      )}
    >
      {value}
    </span>
  );
}

export function FraudTypeBadge({ value }: { value: FraudType }) {
  return (
    <span className="inline-flex rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
      {value}
    </span>
  );
}
