import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface GraficoPizzaProps<T extends object> {
  data: T[];
  dataKey: keyof T;
  nameKey: keyof T;
  colors?: string[];
}

export function GraficoPizza<T extends object>({
  data,
  dataKey,
  nameKey,
  colors = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8'],
}: GraficoPizzaProps<T>) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '16px',
            }}
          />
          <Pie
            data={data}
            dataKey={dataKey as string}
            nameKey={nameKey as string}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={4}
          >
            {data.map((_, index) => (
              <Cell key={`slice-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
