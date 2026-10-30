import React from 'react';
import { format } from 'date-fns';
import { PendingActions } from './PendingActions';

interface HeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');
  return (
    <div className="flex items-start justify-between gap-3 mb-5 md:mb-8">
      <div className="min-w-0">
        <h1 className="font-headline text-xl md:text-2xl font-bold text-white flex items-center gap-2">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{subtitle}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{today}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 [&_button]:whitespace-nowrap">
        {actions}
        <PendingActions />
      </div>
    </div>
  );
};
