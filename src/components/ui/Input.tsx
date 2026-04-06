import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, hint, className = '', id, ...props }) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm text-on-surface placeholder-slate-500
          bg-surface-container-highest
          focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50
          transition-colors
          ${error ? 'border-error/50 bg-error-container/10' : 'border-white/10 hover:border-white/20'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
};
