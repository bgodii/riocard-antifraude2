import { Filter } from 'lucide-react';
import type { FilterOptions, FilterState } from '@/types/fraud';

interface FiltersPanelProps {
  filters: FilterState;
  options: FilterOptions;
  onChange: (key: keyof FilterState, value: string) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-cyan-300/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltersPanel({ filters, options, onChange }: FiltersPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
        <Filter size={16} />
        Filtros avancados
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ID do cartao</span>
          <input
            type="text"
            placeholder="Ex: RIO-1001"
            value={filters.cardId}
            onChange={(event) => onChange('cardId', event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
          />
        </label>

        <SelectField
          label="Tipo de fraude"
          value={filters.fraudType}
          onChange={(value) => onChange('fraudType', value)}
          options={[
            { label: 'Todos os tipos', value: 'all' },
            ...options.fraudTypes.map((type) => ({ label: type, value: type })),
          ]}
        />

        <SelectField
          label="Estacao"
          value={filters.station}
          onChange={(value) => onChange('station', value)}
          options={[
            { label: 'Todas as estacoes', value: 'all' },
            ...options.stations.map((station) => ({ label: station, value: station })),
          ]}
        />

        <SelectField
          label="Linha de onibus"
          value={filters.line}
          onChange={(value) => onChange('line', value)}
          options={[
            { label: 'Todas as linhas', value: 'all' },
            ...options.lines.map((line) => ({ label: line, value: line })),
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Data inicial</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => onChange('startDate', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Data final</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => onChange('endDate', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
