import clsx from 'clsx';
import type { RiskLevel } from '@/types/common';

const badgeByRisk: Record<RiskLevel, string> = {
  baixo: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  medio: 'bg-amber-100 text-amber-700 ring-amber-200',
  alto: 'bg-rose-100 text-rose-700 ring-rose-200',
};

export function BadgeRisco({ level }: { level: RiskLevel }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ring-inset',
        badgeByRisk[level],
      )}
    >
      {level}
    </span>
  );
}
