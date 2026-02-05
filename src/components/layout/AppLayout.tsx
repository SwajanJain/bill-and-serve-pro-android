import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="h-screen overflow-hidden">
      {/* Desktop layout */}
      <div className="hidden md:flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col h-full">
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
