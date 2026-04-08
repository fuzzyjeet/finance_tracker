import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  PieChart,
  RefreshCw,
  TrendingUp,
  FolderOpen,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/budgets', icon: PieChart, label: 'Budgets' },
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar-themed hidden md:flex flex-col h-full py-8 w-64 border-r shrink-0 transition-all duration-300 ease-in-out" style={{ borderColor: 'var(--sidebar-border)' }}>
      {/* Logo */}
      <div className="px-6 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
            <TrendingUp size={16} className="text-on-primary-container" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-black text-white tracking-normal">JeetMoney</h1>
            <p className="text-[10px] tracking-[0.2em]" style={{ color: 'var(--sidebar-text)' }}>Institutional Grade</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 py-3 px-6 text-xs font-medium uppercase tracking-widest transition-all duration-300 ease-in-out ${
                isActive
                  ? 'text-primary bg-primary/10 border-r-2 border-primary'
                  : 'hover:text-slate-200 hover:bg-white/5'
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
            `flex items-center gap-3 py-3 px-6 text-xs font-medium uppercase tracking-widest transition-all duration-300 ease-in-out ${
              isActive
                ? 'text-primary bg-primary/10 border-r-2 border-primary'
                : 'hover:text-slate-200 hover:bg-white/5'
            }`
          }
          style={({ isActive }) => ({ color: isActive ? undefined : 'var(--sidebar-text)' })}
        >
          <Settings size={16} />
          Settings
        </NavLink>
        <div className="px-6 pb-2 pt-1">
          <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--sidebar-text)' }}>Finance Tracker v1.0</p>
        </div>
      </div>
    </aside>
  );
};
