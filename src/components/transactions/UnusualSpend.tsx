import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Transaction } from '../../types';

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/** Warning icon next to an expense that is more than 2x its category's usual amount. */
export const UnusualIcon: React.FC<{ txn: Transaction; onExplain: (txn: Transaction) => void }> = ({ txn, onExplain }) => {
  if (!txn.typical_amount) return null;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onExplain(txn); }}
      onPointerDown={e => e.stopPropagation()}
      className="inline-flex items-center justify-center w-7 h-7 -my-1 rounded-lg shrink-0"
      style={{ color: 'var(--warn)' }}
      aria-label="Higher than usual"
      title="Higher than usual for this category"
    >
      <AlertTriangle size={15} />
    </button>
  );
};

export const UnusualExplainer: React.FC<{
  txn: Transaction | null;
  onClose: () => void;
  onOpen: (txn: Transaction) => void;
}> = ({ txn, onClose, onOpen }) => {
  const typical = txn?.typical_amount ?? 0;
  const category = txn?.category?.name ?? 'this category';
  return (
    <Modal isOpen={!!txn && typical > 0} onClose={onClose} title="Higher than usual" size="sm">
      {txn && typical > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgb(var(--warn-rgb) / 0.1)' }}>
            <AlertTriangle size={20} className="shrink-0" style={{ color: 'var(--warn)' }} />
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              <span className="font-semibold">{txn.payee}</span> ({fmt(txn.amount)}) is{' '}
              <span className="font-semibold">{(txn.amount / typical).toFixed(1)}×</span> your usual {category} spend.
            </p>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Usual = {fmt(typical)}, the middle amount of your {category} expenses in the 90 days before this one.
            Anything over twice that gets flagged.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { onClose(); onOpen(txn); }}>Open entry</Button>
            <Button onClick={onClose}>OK</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
