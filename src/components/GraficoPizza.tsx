import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface GraficoPizzaProps<T extends object> {
  data: T[];
  dataKey: keyof T;
  nameKey: keyof T;
  colors?: string[];
  centerLabel?: string;
  valueLabel?: string;
  descriptions?: Partial<Record<string, string>>;
}

export function GraficoPizza<T extends object>({
  data,
  dataKey,
  nameKey,
  colors = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8'],
  centerLabel = 'Total',
  valueLabel = 'registros',
  descriptions,
}: GraficoPizzaProps<T>) {
  const entries = data.map((item) => {
    const name = String(item[nameKey] ?? '');
    const rawValue = item[dataKey];
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

    return { name, value };
  });

  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
      <div className="relative h-72 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} ${valueLabel}`, name]}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #cfe0f5',
                borderRadius: '16px',
                color: '#12345b',
              }}
              labelStyle={{ color: '#0454a3', fontWeight: 600 }}
            />
            <Pie
              data={entries}
              dataKey="value"
              nameKey="name"
              innerRadius={74}
              outerRadius={104}
              paddingAngle={3}
              stroke="#ffffff"
              strokeWidth={2}
              labelLine={false}
              label={({ value, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                if (!value || !percent || percent < 0.04) {
                  return null;
                }

                const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.55;
                const x = Number(cx) + radius * Math.cos((-Number(midAngle) * Math.PI) / 180);
                const y = Number(cy) + radius * Math.sin((-Number(midAngle) * Math.PI) / 180);

                return (
                  <text
                    x={x}
                    y={y}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontWeight={700}
                  >
                    {value}
                  </text>
                );
              }}
            >
              {entries.map((entry, index) => (
                <Cell key={`slice-${entry.name}-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/95 px-5 py-4 text-center shadow-sm ring-1 ring-[#d7e6f7]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{centerLabel}</p>
            <p className="mt-1 text-3xl font-semibold text-panel">{total}</p>
            <p className="text-xs text-slate-500">{valueLabel}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const percentage = total > 0 ? (entry.value / total) * 100 : 0;

          return (
            <div key={`legend-${entry.name}-${index}`} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <p className="text-sm font-semibold text-panel">{entry.name}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {descriptions?.[entry.name] ?? `Quantidade de ${valueLabel} classificados nesta faixa.`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-panel">{entry.value}</p>
                  <p className="text-xs text-slate-500">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
