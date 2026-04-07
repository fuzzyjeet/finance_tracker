import React from 'react';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Drop-in wrapper around CustomSelect that preserves the existing
 * onChange(e: ChangeEvent<HTMLSelectElement>) API used throughout the app.
 */
export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  value = '',
  onChange,
  disabled,
  className,
}) => {
  const csOptions: CustomSelectOption[] = [
    ...(placeholder ? [{ value: '', label: placeholder }] : []),
    ...options,
  ];

  const handleChange = (v: string) => {
    if (!onChange) return;
    // Synthesise a ChangeEvent so callers don't need updating
    const synth = { target: { value: v } } as React.ChangeEvent<HTMLSelectElement>;
    onChange(synth);
  };

  return (
    <CustomSelect
      label={label}
      error={error}
      options={csOptions}
      value={value}
      onChange={handleChange}
      placeholder={placeholder ? undefined : 'Select…'}
      disabled={disabled}
      className={className}
    />
  );
};
