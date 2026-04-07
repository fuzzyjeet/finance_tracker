import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

const DROPDOWN_MAX_H = 272; // px
const ITEM_H = 36;          // approx px per option

// ── Dropdown list (portaled) ───────────────────────────────
function DropdownList({
  options,
  value,
  pos,
  onSelect,
  onClose,
  triggerRef,
}: {
  options: CustomSelectOption[];
  value: string;
  pos: DropdownPos;
  onSelect: (v: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — but NOT when clicking the trigger
  // (the trigger handles its own toggle so we avoid a double-fire race)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (listRef.current && !listRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, triggerRef]);

  // Scroll selected item into view
  useLayoutEffect(() => {
    if (!listRef.current) return;
    const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    sel?.scrollIntoView({ block: 'nearest' });
  }, []);

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos.left,
    width: Math.max(pos.width, 180),
    zIndex: 99999,
    background: '#131c30',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
    overflowY: 'auto',
    maxHeight: DROPDOWN_MAX_H,
    ...(pos.openUp
      ? { bottom: window.innerHeight - pos.top + 4 }
      : { top: pos.top + 4 }),
  };

  return createPortal(
    <div ref={listRef} style={style} onMouseDown={e => e.preventDefault()}>
      {options.map(opt => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            data-selected={isSelected}
            onClick={() => { onSelect(opt.value); onClose(); }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors"
            style={{
              color:      isSelected ? '#dae2fd' : '#bdc8d1',
              background: isSelected ? 'rgba(142,213,255,0.08)' : 'transparent',
            }}
            onMouseEnter={e => {
              if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span>{opt.label}</span>
            {isSelected && <Check size={12} style={{ color: '#8ed5ff', flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

// ── Public component ───────────────────────────────────────
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /**
   * When true, the trigger is rendered as a full-area invisible button.
   * Useful when the visual display is handled externally (e.g. FieldRow).
   */
  invisible?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  label,
  error,
  disabled,
  className = '',
  style,
  invisible = false,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState<DropdownPos>({ top: 0, left: 0, width: 0, openUp: false });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.value === value);

  const openDropdown = () => {
    if (disabled || !triggerRef.current) return;
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedH = Math.min(options.length * ITEM_H, DROPDOWN_MAX_H);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedH + 8 && rect.top > estimatedH + 8;
    setPos({ top: rect.bottom, left: rect.left, width: rect.width, openUp });
    setOpen(true);
  };

  if (invisible) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={openDropdown}
          disabled={disabled}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: disabled ? 'default' : 'pointer', width: '100%', height: '100%' }}
          aria-label="Open dropdown"
        />
        {open && (
          <DropdownList
            options={options}
            value={value}
            pos={pos}
            onSelect={onChange}
            onClose={() => setOpen(false)}
            triggerRef={triggerRef}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1" style={style}>
      {label && (
        <label className="text-[10px] font-medium uppercase tracking-widest" style={{ color: '#6b7280' }}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={[
          'flex items-center justify-between gap-2 text-sm text-left transition-colors rounded-lg px-3 py-2',
          'border outline-none',
          disabled ? 'opacity-40 cursor-default' : 'cursor-pointer',
          className,
        ].join(' ')}
        style={{
          background:   '#171f33',
          borderColor:  open ? 'rgba(142,213,255,0.35)' : 'rgba(255,255,255,0.08)',
          color:        selected ? '#dae2fd' : '#4b5563',
          boxShadow:    open ? '0 0 0 1px rgba(142,213,255,0.2)' : 'none',
          ...style,
        }}
      >
        <span className="truncate flex-1">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={14}
          style={{
            color:     '#6b7280',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>
      {error && <p className="text-xs" style={{ color: '#ffb4ab' }}>{error}</p>}
      {open && (
        <DropdownList
          options={options}
          value={value}
          pos={pos}
          onSelect={onChange}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
        />
      )}
    </div>
  );
};
