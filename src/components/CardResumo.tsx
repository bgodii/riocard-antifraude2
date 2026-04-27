import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardResumoProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const toneStyles = {
  default: 'from-white to-[#eef6ff] border-line',
  success: 'from-[#f4fff7] to-white border-emerald-200',
  warning: 'from-[#fff9e7] to-white border-[#ffd768]',
  danger: 'from-[#fff2f2] to-white border-rose-200',
};

export function CardResumo({ title, value, subtitle, icon, tone = 'default' }: CardResumoProps) {
  return (
    <article className={clsx('rounded-3xl border bg-gradient-to-br p-5 shadow-glow', toneStyles[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-panel">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-accent shadow-sm">{icon}</div>
      </div>
    </article>
  );
}
