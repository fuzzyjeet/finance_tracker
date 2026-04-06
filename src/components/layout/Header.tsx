import React from 'react';
import { format } from 'date-fns';

interface HeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-white flex items-center gap-2">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{subtitle}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{today}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
