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
        ? { backgroundColor: color, color: '#fff' }
        : { backgroundColor: `${color}22`, color };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
        style={style}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ${className}`}
    >
      {children}
    </span>
  );
};
