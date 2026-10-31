import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SyncBanner } from './SyncBanner';
import { PullToRefresh } from './PullToRefresh';
import { emitDataChanged } from '../../lib/events';
import { localISODate } from '../../lib/dates';

export const Layout: React.FC = () => {
  const mainRef = useRef<HTMLElement>(null);
  // The installed app can sit in the background for days: when it comes back on a
  // new day, reload so "today", the missing-days strip and totals are current
  useEffect(() => {
    let day = localISODate();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || localISODate() === day) return;
      day = localISODate();
      emitDataChanged();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface text-on-surface font-body">
      <Sidebar />
      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain bg-surface-dim">
        {/* Phones and tablets: clear the notch on top, and the tab bar + floating button at the
            bottom; tablets keep a comfortable reading width. Desktop gets the sidebar */}
        <div className="max-w-3xl lg:max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-safe-page pb-safe-page">
          <SyncBanner />
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <PullToRefresh scroller={mainRef} />
    </div>
  );
};
