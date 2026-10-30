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
        ? { backgroundColor: color, color: 'var(--bg)' }
        : { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
        style={style}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-highest text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
};
