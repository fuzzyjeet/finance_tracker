import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { emitTabReselected } from '../../lib/events';
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  PieChart,
  RefreshCw,
  TrendingUp,
  FolderOpen,
  Settings,
  HeartPulse,
} from 'lucide-react';

const navItems = [
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/budgets', icon: PieChart, label: 'Budgets' },
  { to: '/health', icon: HeartPulse, label: 'Health' },
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
];

export const Sidebar: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <aside className="sidebar-themed hidden lg:flex flex-col h-full py-8 w-64 border-r shrink-0 transition-all duration-300 ease-in-out" style={{ borderColor: 'var(--sidebar-border)' }}>
      {/* Logo */}
      <div className="px-6 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
            <TrendingUp size={16} className="text-on-primary-container" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-black text-on-surface tracking-normal">JeetMoney</h1>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => { if (pathname === to) emitTabReselected(to); }}
            className={({ isActive }) =>
              `flex items-center gap-3 py-3 px-6 text-xs font-medium transition-all duration-300 ease-in-out ${
                isActive
                  ? 'text-primary bg-primary/10 border-r-2 border-primary'
                  : 'hover:text-on-surface hover:bg-white/5'
              }`
            }
            style={({ isActive }) => ({ color: isActive ? undefined : 'var(--sidebar-text)' })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Settings + Footer */}
      <div className="mt-auto" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 py-3 px-6 text-xs font-medium transition-all duration-300 ease-in-out ${
              isActive
                ? 'text-primary bg-primary/10 border-r-2 border-primary'
                : 'hover:text-on-surface hover:bg-white/5'
            }`
          }
          style={({ isActive }) => ({ color: isActive ? undefined : 'var(--sidebar-text)' })}
        >
          <Settings size={16} />
          Settings
        </NavLink>
        <div className="px-6 pb-2 pt-1">
          <p className="text-xs" style={{ color: 'var(--sidebar-text)' }}>Finance Tracker v1.0</p>
        </div>
      </div>
    </aside>
  );
};
