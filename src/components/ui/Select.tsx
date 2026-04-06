import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm text-on-surface
          bg-surface-container-highest
          focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50
          transition-colors
          ${error ? 'border-error/50' : 'border-white/10 hover:border-white/20'}
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
};
