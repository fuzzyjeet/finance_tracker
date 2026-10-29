import React from 'react';
import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { navItems } from './Sidebar';

// Seven tabs share a phone's width, so the longest labels are shortened
const shortLabels: Record<string, string> = { '/': 'Home', '/transactions': 'Activity' };

const items = [...navItems, { to: '/settings', icon: Settings, label: 'Settings' }].map(item => ({
  ...item,
  label: shortLabels[item.to] ?? item.label,
}));

export const MobileNav: React.FC = () => {
  return (
    <nav
      className="sidebar-themed md:hidden flex border-t shrink-0 pb-[env(safe-area-inset-bottom)]"
      style={{ borderColor: 'var(--sidebar-border)' }}
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 min-w-0 flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] font-medium tracking-tight transition-colors ${
              isActive ? 'text-primary' : ''
            }`
          }
          style={({ isActive }) => ({ color: isActive ? undefined : 'var(--sidebar-text)' })}
        >
          <Icon size={20} />
          <span className="truncate max-w-full">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
