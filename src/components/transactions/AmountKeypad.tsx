import React from 'react';
import { Delete } from 'lucide-react';
import { cleanExpression, evaluate, hasOperator } from '../../lib/amountMath';

const toInput = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));

type Key = { label: React.ReactNode; value: string; kind: 'digit' | 'op' | 'action'; span?: number; aria?: string };

const KEYS: Key[] = [
  { label: 'C', value: 'clear', kind: 'action', aria: 'Clear' },
  { label: '÷', value: '÷', kind: 'op', aria: 'Divide' },
  { label: '×', value: '×', kind: 'op', aria: 'Times' },
  { label: <Delete size={20} />, value: 'back', kind: 'action', aria: 'Delete' },
  { label: '7', value: '7', kind: 'digit' }, { label: '8', value: '8', kind: 'digit' }, { label: '9', value: '9', kind: 'digit' },
  { label: '−', value: '−', kind: 'op', aria: 'Minus' },
  { label: '4', value: '4', kind: 'digit' }, { label: '5', value: '5', kind: 'digit' }, { label: '6', value: '6', kind: 'digit' },
  { label: '+', value: '+', kind: 'op', aria: 'Plus' },
  { label: '1', value: '1', kind: 'digit' }, { label: '2', value: '2', kind: 'digit' }, { label: '3', value: '3', kind: 'digit' },
  { label: '=', value: '=', kind: 'op', aria: 'Equals' },
  { label: ',', value: ',', kind: 'digit', aria: 'Decimal comma' }, { label: '0', value: '0', kind: 'digit' },
];

/** What a key press does to the amount text. */
export function pressKey(expr: string, key: string): string {
  const last = expr.slice(-1);
  const isOp = (c: string) => '+−×÷'.includes(c);
  if (key === 'clear') return '';
  if (key === 'back') return expr.slice(0, -1);
  if (key === '=') {
    const v = evaluate(expr);
    return v === null || v < 0 ? expr : toInput(v);
  }
  if (isOp(key)) {
    if (!expr) return expr;  // nothing to work on yet
    return isOp(last) ? expr.slice(0, -1) + key : expr + key;
  }
  if (key === ',') {
    const number = expr.split(/[+−×÷]/).pop() ?? '';
    if (number.includes(',')) return expr;
    return expr + (number ? ',' : '0,');
  }
  return cleanExpression(expr + key);
}

/**
 * Calculator keypad for the amount, in place of the phone's keyboard: digits, comma,
 * + − × ÷, = to work out the sum, and Next to move on to the payee.
 */
export const AmountKeypad: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  accent: string;
}> = ({ value, onChange, onNext, accent }) => {
  const press = (key: string) => onChange(pressKey(value, key));
  const sum = hasOperator(value) ? evaluate(value) : null;

  return (
    <div className="shrink-0 px-3 pt-2 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-low)' }}>
      <div className="grid grid-cols-4 gap-1.5 select-none">
        {KEYS.map(k => (
          <button
            key={k.value}
            type="button"
            aria-label={k.aria}
            // Keep the focus (and caret) on the amount; act on pointer down for a snappy feel
            onPointerDown={e => { e.preventDefault(); press(k.value); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(k.value); } }}
            className="h-12 rounded-xl flex items-center justify-center text-xl font-semibold active:brightness-150 transition-[filter]"
            style={{
              background: k.kind === 'digit' ? 'var(--surface-hi)' : 'var(--surface)',
              color: k.kind === 'op' ? accent : 'var(--text)',
            }}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          // A click (not pointer down) so iOS lets Next raise the keyboard for the payee
          onMouseDown={e => e.preventDefault()}
          onClick={() => { if (sum !== null) onChange(pressKey(value, '=')); onNext(); }}
          className="col-span-2 h-12 rounded-xl flex items-center justify-center gap-2 text-base font-semibold"
          style={{ background: accent, color: 'var(--on-accent)' }}
        >
          {sum !== null ? `= ${toInput(sum)} · Next` : 'Next'}
        </button>
      </div>
    </div>
  );
};
