import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FinancialEntry } from '@/types/financial';

interface FinancialDataContextValue {
  entries: FinancialEntry[];
  sourceLabel: string;
  setFinancialEntries: (entries: FinancialEntry[], label: string) => void;
  clearFinancialEntries: () => void;
}

const FinancialDataContext = createContext<FinancialDataContextValue | null>(null);

export function FinancialDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [sourceLabel, setSourceLabel] = useState('Nenhuma base financeira carregada');

  const value = useMemo<FinancialDataContextValue>(
    () => ({
      entries,
      sourceLabel,
      setFinancialEntries: (nextEntries, label) => {
        setEntries(nextEntries);
        setSourceLabel(label);
      },
      clearFinancialEntries: () => {
        setEntries([]);
        setSourceLabel('Nenhuma base financeira carregada');
      },
    }),
    [entries, sourceLabel],
  );

  return <FinancialDataContext.Provider value={value}>{children}</FinancialDataContext.Provider>;
}

export function useFinancialData() {
  const context = useContext(FinancialDataContext);

  if (!context) {
    throw new Error('useFinancialData must be used within FinancialDataProvider');
  }

  return context;
}
