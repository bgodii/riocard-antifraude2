import { Navigate, Route, Routes } from 'react-router-dom';
import { MonitoringDataProvider } from '@/context/MonitoringDataContext';
import { AppLayout } from '@/layout/AppLayout';
import { CardSharingPage } from '@/pages/CardSharingPage';
import { CopilotPage } from '@/pages/CopilotPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FinancialPage } from '@/pages/FinancialPage';
import { InformalSalesPage } from '@/pages/InformalSalesPage';
import { RiskActionsPage } from '@/pages/RiskActionsPage';
import { TicketingPage } from '@/pages/TicketingPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { UserBehaviorPage } from '@/pages/UserBehaviorPage';

export default function App() {
  return (
    <MonitoringDataProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transacoes" element={<TransactionsPage />} />
          <Route path="/bilhetagem" element={<TicketingPage />} />
        <Route path="/compartilhamento" element={<CardSharingPage />} />
        <Route path="/vendas" element={<InformalSalesPage />} />
        <Route path="/comportamento" element={<UserBehaviorPage />} />
        <Route path="/acoes-risco" element={<RiskActionsPage />} />
        <Route path="/financeiro" element={<FinancialPage />} />
        <Route path="/copilot" element={<CopilotPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </MonitoringDataProvider>
  );
}
