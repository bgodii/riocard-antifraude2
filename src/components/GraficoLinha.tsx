import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface GraficoLinhaProps<T extends object> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
}

export function GraficoLinha<T extends object>({
  data,
  xKey,
  yKey,
  color = '#14b8a6',
}: GraficoLinhaProps<T>) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
          <XAxis dataKey={xKey as string} stroke="#94a3b8" tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '16px',
            }}
          />
          <Line type="monotone" dataKey={yKey as string} stroke={color} strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
