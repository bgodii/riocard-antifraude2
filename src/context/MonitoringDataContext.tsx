import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UploadedDataset } from '@/types/fraud';
import { analyzeTransactions } from '@/utils/fraudDetection';
import { normalizeSpreadsheetRows } from '@/utils/spreadsheet';

interface MonitoringDataContextValue {
  dataset: UploadedDataset;
  sourceLabel: string;
  setDatasetFromRows: (rows: Record<string, unknown>[], label: string) => void;
}

const MonitoringDataContext = createContext<MonitoringDataContextValue | null>(null);

function createEmptyDataset(): UploadedDataset {
  return {
    rawRows: [],
    transactions: [],
    alerts: [],
    stats: {
      totalTransactions: 0,
      averageDailyUsage: 0,
      uniqueCards: 0,
    },
  };
}

function buildDataset(rows: Record<string, unknown>[]): UploadedDataset {
  const transactions = normalizeSpreadsheetRows(rows);
  const analysis = analyzeTransactions(transactions);

  return {
    rawRows: rows,
    transactions,
    alerts: analysis.alerts,
    stats: analysis.stats,
  };
}

export function MonitoringDataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<UploadedDataset>(() => createEmptyDataset());
  const [sourceLabel, setSourceLabel] = useState('Nenhuma base carregada');

  const value = useMemo<MonitoringDataContextValue>(
    () => ({
      dataset,
      sourceLabel,
      setDatasetFromRows: (rows, label) => {
        setDataset(buildDataset(rows));
        setSourceLabel(label);
      },
    }),
    [dataset, sourceLabel],
  );

  return <MonitoringDataContext.Provider value={value}>{children}</MonitoringDataContext.Provider>;
}

export function useMonitoringData() {
  const context = useContext(MonitoringDataContext);

  if (!context) {
    throw new Error('useMonitoringData must be used within MonitoringDataProvider');
  }

  return context;
}
