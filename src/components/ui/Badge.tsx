import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  variant?: 'solid' | 'soft';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color,
  className = '',
  variant = 'soft',
}) => {
  if (color) {
    const style =
      variant === 'solid'
        ? { backgroundColor: color, color: '#0b1326' }
        : { backgroundColor: `${color}22`, color };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-tight ${className}`}
        style={style}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-tight bg-surface-container-highest text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
};
