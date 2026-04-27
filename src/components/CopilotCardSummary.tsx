import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CreditCard, ShieldAlert, Wallet } from 'lucide-react';
import { BadgeRisco } from '@/components/BadgeRisco';
import type { CardLookupResult } from '@/types/copilot';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDateTime(dateTime: string | null) {
  if (!dateTime) {
    return 'Sem validacao recente';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateTime));
}

export function CopilotCardSummary({ lookup }: { lookup: CardLookupResult | null }) {
  if (!lookup) {
    return (
      <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-panel">Resumo do cartao</h2>
            <p className="text-sm text-slate-600">O resumo aparece automaticamente depois que o cliente informa o numero do cartao.</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo do cartao</p>
          <h2 className="mt-2 text-2xl font-semibold text-panel">{lookup.summary.maskedCardId}</h2>
        </div>
        <BadgeRisco level={lookup.summary.riskScore} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-panel">
            <Wallet size={16} />
            Saldo estimado
          </div>
          <p className="mt-2 text-2xl font-semibold text-panel">{formatCurrency(lookup.summary.estimatedBalance)}</p>
        </div>

        <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-panel">
            <ShieldAlert size={16} />
            Status
          </div>
          <p
            className={clsx(
              'mt-2 text-2xl font-semibold',
              lookup.summary.status === 'bloqueado' && 'text-rose-700',
              lookup.summary.status === 'atencao' && 'text-amber-700',
              lookup.summary.status === 'ativo' && 'text-emerald-700',
            )}
          >
            {lookup.summary.status}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-[#f8fbff] p-4 text-sm text-slate-600">
        {lookup.summary.statusReason}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultima validacao</p>
          <p className="mt-2 text-sm font-medium text-panel">{formatDateTime(lookup.summary.lastValidation)}</p>
          <p className="mt-1 text-sm text-slate-600">{lookup.summary.lastLocation}</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alertas recentes</p>
          <p className="mt-2 text-sm font-medium text-panel">{lookup.summary.alertCount} ocorrencia(s)</p>
          <p className="mt-1 text-sm text-slate-600">{lookup.summary.failureCount} falha(s) consultada(s) para atendimento</p>
        </div>
      </div>

      {lookup.alerts.length ? (
        <div className="mt-4 rounded-2xl border border-[#ffd768] bg-[#fff8df] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-panel">
            <AlertTriangle size={16} />
            Sinais importantes
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {lookup.alerts.slice(0, 2).map((alert) => (
              <li key={alert.id} className="rounded-2xl bg-white/80 px-3 py-2">
                {alert.fraudType}: {alert.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={16} />
            Sem alerta critico ativo na base atual
          </div>
        </div>
      )}
    </article>
  );
}
