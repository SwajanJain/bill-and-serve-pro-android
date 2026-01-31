import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Main content area - with padding for bottom nav */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom navigation for mobile */}
      <BottomNav />
    </div>
  );
}
