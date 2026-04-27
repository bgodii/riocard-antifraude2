import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsBundle } from '@/types/fraud';

interface ChartsSectionProps {
  analytics: AnalyticsBundle;
}

const chartPalette = ['#0454a3', '#0077d4', '#ffc928', '#ff9f1c', '#22c55e', '#ef4444'];

export function ChartsSection({ analytics }: ChartsSectionProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <article className="rounded-[28px] border border-line bg-white p-5 shadow-sm xl:col-span-1">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Fraudes por tipo</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.fraudByType}>
              <CartesianGrid stroke="rgba(4,84,163,0.10)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#56708f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#56708f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #cfe0f5', borderRadius: '16px' }}
                labelStyle={{ color: '#0454a3' }}
              />
              <Bar dataKey="total" radius={[14, 14, 0, 0]}>
                {analytics.fraudByType.map((entry, index) => (
                  <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[28px] border border-line bg-white p-5 shadow-sm xl:col-span-1">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Fraudes ao longo do tempo</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.fraudTimeline}>
              <CartesianGrid stroke="rgba(4,84,163,0.10)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#56708f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#56708f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #cfe0f5', borderRadius: '16px' }}
                labelStyle={{ color: '#0454a3' }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#0077d4" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-[28px] border border-line bg-white p-5 shadow-sm xl:col-span-1">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Distribuicao por localizacao</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.fraudByLocation} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke="rgba(4,84,163,0.10)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#56708f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fill: '#56708f', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #cfe0f5', borderRadius: '16px' }}
                labelStyle={{ color: '#0454a3' }}
              />
              <Bar dataKey="total" radius={[0, 14, 14, 0]} fill="#ffc928" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
