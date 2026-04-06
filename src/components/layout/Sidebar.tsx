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
    <aside className="hidden md:flex flex-col h-full py-8 bg-[#0b1326] w-64 border-r border-white/5 shrink-0 transition-all duration-300 ease-in-out">
      {/* Logo */}
      <div className="px-6 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
            <TrendingUp size={16} className="text-on-primary-container" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-black text-white tracking-normal">JeetMoney</h1>
            <p className="text-[10px] text-slate-500 tracking-[0.2em]">Institutional Grade</p>
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
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-6 pt-6 border-t border-white/5">
        <p className="text-[10px] text-slate-500 tracking-widest uppercase">Finance Tracker v1.0</p>
      </div>
    </aside>
  );
};
