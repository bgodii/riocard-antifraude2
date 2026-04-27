import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BarSeries<T extends object> {
  dataKey: keyof T;
  color: string;
  name: string;
}

interface GraficoBarraProps<T extends object> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  colors?: string[];
  series?: BarSeries<T>[];
}

export function GraficoBarra<T extends object>({
  data,
  xKey,
  yKey,
  colors = ['#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8'],
  series,
}: GraficoBarraProps<T>) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={10}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
          <XAxis dataKey={xKey as string} stroke="#94a3b8" tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #cfe0f5',
              borderRadius: '16px',
              color: '#12345b',
            }}
            labelStyle={{ color: '#0454a3', fontWeight: 600 }}
          />
          {series?.length ? <Legend wrapperStyle={{ color: '#56708f' }} /> : null}
          {series?.length ? (
            series.map((item) => (
              <Bar key={item.name} dataKey={item.dataKey as string} name={item.name} radius={[12, 12, 0, 0]} fill={item.color} />
            ))
          ) : (
            <Bar dataKey={yKey as string} radius={[12, 12, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
