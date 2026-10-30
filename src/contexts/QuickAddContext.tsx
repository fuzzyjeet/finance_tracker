import React, { createContext, useContext, useState } from 'react';
import { Plus } from 'lucide-react';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { emitDataChanged } from '../lib/events';

interface QuickAddOptions { date?: string }

const QuickAddContext = createContext<(opts?: QuickAddOptions) => void>(() => {});

/** Opens the global "add transaction" flow, optionally prefilled with a date. */
export const useQuickAdd = () => useContext(QuickAddContext);

export const QuickAddProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string | undefined>();

  const openAdd = (opts?: QuickAddOptions) => {
    setDate(opts?.date);
    setOpen(true);
  };

  return (
    <QuickAddContext.Provider value={openAdd}>
      {children}

      {/* Floating add button — bottom-left: above the tab bar on phones, clear of the sidebar on desktop */}
      <button
        onClick={() => openAdd()}
        className="fixed fab-position w-14 h-14 bg-primary-container text-on-primary-container rounded-full shadow-lg flex items-center justify-center transition-all hover:brightness-110 active:scale-95 z-40"
        title="Add transaction"
        aria-label="Add transaction"
      >
        <Plus size={24} />
      </button>

      <TransactionFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSaved={emitDataChanged}
        defaultDate={date}
      />
    </QuickAddContext.Provider>
  );
};
