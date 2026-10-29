import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowLeftRight, CreditCard, MoreHorizontal, Settings, X } from 'lucide-react';
import { navItems } from './Sidebar';

// Phones get four tabs; the remaining pages live in the More sheet
const tabPaths = ['/transactions', '/accounts'];
const moreItems = navItems.filter(item => !tabPaths.includes(item.to));

const tabCls = (active: boolean) =>
  `flex-1 min-w-0 flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] font-medium tracking-tight transition-colors ${
    active ? 'text-primary' : ''
  }`;
const tabStyle = (active: boolean) => ({ color: active ? undefined : 'var(--sidebar-text)' });

export const MobileNav: React.FC = () => {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  const inMore = moreItems.some(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to)));

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="sidebar-themed absolute left-0 right-0 bottom-0 rounded-t-2xl border-t pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
            style={{ borderColor: 'var(--sidebar-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--sidebar-text)' }}>More</span>
              <button onClick={() => setMoreOpen(false)} className="p-1" style={{ color: 'var(--sidebar-text)' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {moreItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-5 py-3.5 text-sm font-medium ${isActive ? 'text-primary bg-primary/10' : 'text-slate-200'}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav
        className="sidebar-themed md:hidden relative z-50 flex border-t shrink-0 pb-[env(safe-area-inset-bottom)]"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <NavLink to="/transactions" className={({ isActive }) => tabCls(isActive && !moreOpen)} style={({ isActive }) => tabStyle(isActive && !moreOpen)}>
          <ArrowLeftRight size={20} />
          <span>Activity</span>
        </NavLink>
        <NavLink to="/accounts" className={({ isActive }) => tabCls(isActive && !moreOpen)} style={({ isActive }) => tabStyle(isActive && !moreOpen)}>
          <CreditCard size={20} />
          <span>Accounts</span>
        </NavLink>
        <button type="button" onClick={() => setMoreOpen(o => !o)} className={tabCls(moreOpen || inMore)} style={tabStyle(moreOpen || inMore)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
        <NavLink to="/settings" className={({ isActive }) => tabCls(isActive && !moreOpen)} style={({ isActive }) => tabStyle(isActive && !moreOpen)}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>
    </>
  );
};
