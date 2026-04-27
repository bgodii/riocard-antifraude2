import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useState } from 'react';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-grid bg-[size:22px_22px]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((current) => !current)} />

      <main className="min-h-screen px-4 pb-8 pt-20 lg:ml-80 lg:px-8 lg:pt-8">
        <div className="rounded-[32px] border border-line bg-white/90 p-4 shadow-2xl shadow-sky-100/60 backdrop-blur md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
