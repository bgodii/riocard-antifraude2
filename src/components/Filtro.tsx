import clsx from 'clsx';

interface FilterOption<T extends string> {
  label: string;
  value: T;
}

interface FiltroProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Filtro<T extends string>({ label, options, value, onChange }: FiltroProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <div className="inline-flex w-fit rounded-2xl border border-line bg-white p-1 shadow-sm">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded-xl px-4 py-2 text-sm transition',
              value === option.value
                ? 'bg-panel text-white shadow-md shadow-sky-200/70'
                : 'text-slate-600 hover:bg-[#eef6ff] hover:text-panel',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
