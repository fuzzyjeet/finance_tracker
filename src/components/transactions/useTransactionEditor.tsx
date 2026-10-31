import { useState } from 'react';
import { transactionsApi } from '../../api/transactions';
import { Transaction } from '../../types';
import { emitDataChanged } from '../../lib/events';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TransactionFormModal } from './TransactionFormModal';

/** Opens any entry in the edit form from a list outside Transactions, with delete. */
export function useTransactionEditor() {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const open = async (txn: Transaction | string) => {
    setEditing(typeof txn === 'string' ? await transactionsApi.get(txn) : txn);
  };

  const element = (
    <>
      <TransactionFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); emitDataChanged(); }}
        editing={editing}
        onDelete={editing ? () => { setDeleteId(editing.id); setEditing(null); } : undefined}
      />
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete entry" size="sm">
        <p className="text-sm text-on-surface-variant mb-4">Delete this entry? This can't be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={async () => {
            if (deleteId) await transactionsApi.delete(deleteId);
            setDeleteId(null);
            emitDataChanged();
          }}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );

  return { open, element };
}
