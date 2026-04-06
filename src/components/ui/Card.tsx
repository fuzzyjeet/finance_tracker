import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', padding = true, onClick, glass = false }) => {
  return (
    <div
      className={`${glass ? 'glass-panel' : 'bg-surface-container-low'} rounded-xl border border-white/5 ${padding ? 'p-6' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
