import React, { createContext, useContext, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { emitDataChanged } from '../lib/events';

interface QuickAddOptions { date?: string }

const QuickAddContext = createContext<(opts?: QuickAddOptions) => void>(() => {});
const FabHiddenContext = createContext<(hidden: boolean) => void>(() => {});

/** Opens the global "add transaction" flow, optionally prefilled with a date. */
export const useQuickAdd = () => useContext(QuickAddContext);
/** Hides the + button, e.g. while a bulk-action bar takes its place. */
export const useHideFab = () => useContext(FabHiddenContext);

/**
 * iOS only shows the keyboard for a focus that happens during the tap itself. The form
 * mounts a moment later, so focus a hidden decimal field now; the form then moves the
 * focus to its amount field and the keyboard stays up.
 */
function raiseKeyboard() {
  const proxy = document.createElement('input');
  proxy.setAttribute('inputmode', 'decimal');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;';
  document.body.appendChild(proxy);
  proxy.focus();
  setTimeout(() => proxy.remove(), 1500);
}

export const QuickAddProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string | undefined>();
  const [fabHidden, setFabHidden] = useState(false);
  // The + button belongs to the Transactions page only; other pages are for looking
  const onTransactions = useLocation().pathname.startsWith('/transactions');

  const openAdd = (opts?: QuickAddOptions) => {
    raiseKeyboard();
    setDate(opts?.date);
    setOpen(true);
  };

  return (
    <QuickAddContext.Provider value={openAdd}>
    <FabHiddenContext.Provider value={setFabHidden}>
      {children}

      {/* Floating add button — bottom right, above the tab bar on phones */}
      {onTransactions && !fabHidden && <button
        onClick={() => openAdd()}
        className="fixed fab-position w-14 h-14 bg-primary-container text-on-primary-container rounded-2xl shadow-lg flex items-center justify-center transition-all hover:brightness-110 active:scale-95 z-40"
        title="Add transaction"
        aria-label="Add transaction"
      >
        <Plus size={24} />
      </button>}

      <TransactionFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSaved={emitDataChanged}
        defaultDate={date}
      />
    </FabHiddenContext.Provider>
    </QuickAddContext.Provider>
  );
};
