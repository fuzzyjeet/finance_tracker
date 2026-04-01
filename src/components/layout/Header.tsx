import React from 'react';
import { format } from 'date-fns';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        ) : (
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
