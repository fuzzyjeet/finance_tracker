import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight, LayoutDashboard, PieChart, RefreshCw, MoreHorizontal,
  CreditCard, FolderOpen, Settings, X, HeartPulse,
} from 'lucide-react';
import { emitTabReselected } from '../../lib/events';

const tabs = [
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/budgets', icon: PieChart, label: 'Budgets' },
  { to: '/health', icon: HeartPulse, label: 'Health' },
];

const more = [
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

/** Bottom tab bar for phones (the sidebar takes over from md up). */
export const MobileNav: React.FC = () => {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = more.some(m => pathname.startsWith(m.to));

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const tabCls = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-1 h-14 text-xs font-semibold transition-colors ${
      active ? 'text-primary' : 'text-on-surface-variant'
    }`;

  return (
    <>
      {moreOpen && (
        // Sits above the floating + button but stops at the tab bar so the bar stays usable
        <div
          className="md:hidden fixed inset-x-0 top-0 z-[41]"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-surface-container px-4 pt-3"
            style={{ paddingBottom: '1rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-sm font-semibold text-on-surface">More</p>
              <button onClick={() => setMoreOpen(false)} className="p-2 text-on-surface-variant" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {more.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium ${
                    isActive ? 'text-primary bg-primary/10' : 'text-on-surface'
                  }`
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/5 bg-surface/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => tabCls(isActive)}
            onClick={() => { if (pathname === to) emitTabReselected(to); }}
          >
            <Icon size={20} /> {label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(o => !o)} className={tabCls(moreOpen || moreActive)}>
          <MoreHorizontal size={20} /> More
        </button>
      </nav>
    </>
  );
};
