import clsx from 'clsx';
import { AlertTriangle, BarChart3, BellDot, Bot, CircleDollarSign, Menu, ScanSearch, ShieldAlert, Ticket, Users, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import riocardMaisLogo from '@/assets/riocard-mais-logo.svg';
import { useMonitoringData } from '@/context/MonitoringDataContext';

const navItems = [
  { to: '/', label: 'Dashboard Geral', icon: BarChart3 },
  { to: '/transacoes', label: 'Transacoes Suspeitas', icon: ShieldAlert },
  { to: '/bilhetagem', label: 'Fraude por Bilhetagem', icon: Ticket },
  { to: '/compartilhamento', label: 'Compartilhamento de Cartoes', icon: Users },
  { to: '/vendas', label: 'Vendas Informais', icon: ScanSearch },
  { to: '/comportamento', label: 'Comportamento do Usuario', icon: BellDot },
  { to: '/acoes-risco', label: 'Acoes de Risco', icon: AlertTriangle },
  { to: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { to: '/copilot', label: 'Copilot', icon: Bot },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const { dataset } = useMonitoringData();
  const fraudFamilies = new Set(dataset.alerts.map((alert) => alert.fraudType)).size;

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-2xl border border-line bg-white p-3 text-panel shadow-lg lg:hidden"
        onClick={onToggle}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="fixed left-20 top-4 z-40 rounded-2xl border border-line bg-white px-3 py-2 shadow-lg lg:hidden">
        <img src={riocardMaisLogo} alt="Riocard Mais" className="h-10 w-auto" />
      </div>

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-80 border-r border-line bg-white px-6 py-6 shadow-xl shadow-sky-100/60 transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          <div className="h-2 bg-gradient-to-r from-panel via-accent to-brandSun" />
          <div className="bg-gradient-to-br from-[#eef6ff] via-white to-[#fff8df] p-5">
            <img src={riocardMaisLogo} alt="Riocard Mais" className="h-14 w-auto" />
            <h2 className="mt-4 text-2xl font-semibold text-panel">Central antifraude inteligente</h2>
            <p className="mt-2 text-sm text-slate-600">
              Monitoramento consolidado com leitura operacional por score, bilhetagem, compartilhamento, revenda e comportamento.
            </p>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => open && onToggle()}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                    isActive
                      ? 'bg-panel text-white shadow-lg shadow-sky-200/70'
                      : 'text-slate-700 hover:bg-[#eef6ff] hover:text-panel',
                  )
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-8 rounded-3xl border border-[#ffd768] bg-[#fff8df] p-4 text-sm text-slate-700">
          <p className="font-semibold text-panel">Atualizacao continua</p>
          <p className="mt-1 text-slate-600">
            {dataset.alerts.length} alertas ativos e {fraudFamilies} familia{fraudFamilies === 1 ? '' : 's'} de fraude correlacionada{fraudFamilies === 1 ? '' : 's'}.
          </p>
        </div>
      </aside>

      {open ? <div className="fixed inset-0 z-30 bg-panel/20 lg:hidden" onClick={onToggle} /> : null}
    </>
  );
}
