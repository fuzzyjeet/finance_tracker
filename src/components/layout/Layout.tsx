import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SyncBanner } from './SyncBanner';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface text-on-surface font-body">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overscroll-contain bg-surface-dim">
        {/* On phones: clear the notch on top, and the tab bar + floating button at the bottom */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-safe-page pb-safe-page md:py-8">
          <SyncBanner />
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
};
