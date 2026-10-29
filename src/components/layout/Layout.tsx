import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { OfflineBanner } from './OfflineBanner';

export const Layout: React.FC = () => {
  return (
    // The top padding keeps content clear of the iPhone status bar when installed to the home screen
    <div className="sidebar-themed flex flex-col h-dvh overflow-hidden pt-[env(safe-area-inset-top)] text-on-surface font-body">
      <OfflineBanner />
      <div className="flex flex-1 min-h-0 bg-surface">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-surface-dim">
          <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
};
