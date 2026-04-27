import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface TabelaDadosProps<T> {
  columns: TableColumn<T>[];
  data: T[];
}

export function TabelaDados<T>({ columns, data }: TabelaDadosProps<T>) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-[#f4f8fc]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((row, index) => (
              <tr key={index} className="transition hover:bg-[#f8fbff]">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4 text-sm text-slate-700">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
