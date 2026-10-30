import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Play } from 'lucide-react';
import { recurringApi } from '../../api/recurring';
import { RecurringTransaction } from '../../types';
import { emitDataChanged, onDataChanged } from '../../lib/events';

const fmt = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** Header icon listing recurring transactions that are due and waiting for approval. */
export const PendingActions: React.FC = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<RecurringTransaction[]>([]);
  const [open, setOpen]       = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => recurringApi.pending().then(setPending).catch(() => setPending([]));

  useEffect(() => {
    load();
    return onDataChanged(load);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const postNow = async (id: string) => {
    setPosting(id);
    try {
      await recurringApi.postNow(id);
      emitDataChanged();
    } finally {
      setPosting(null);
    }
  };

  const count = pending.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
          count > 0
            ? 'text-yellow-400 border-yellow-500/30 bg-yellow-400/10 hover:bg-yellow-400/20'
            : 'text-on-surface-variant border-white/5 hover:bg-white/5'
        }`}
        title={count > 0 ? `${count} pending approval${count > 1 ? 's' : ''}` : 'No pending actions'}
        aria-label="Pending actions"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-[10px] font-bold text-black flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl border border-white/10 bg-surface-container shadow-xl">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-sm font-semibold text-on-surface">Pending approvals</p>
            <p className="text-xs text-on-surface-variant">Recurring transactions that are due</p>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-on-surface-variant">You're all caught up</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {pending.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base shrink-0">{item.category?.icon ?? '💸'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{item.name}</p>
                    <p className="text-xs text-on-surface-variant">Due {item.next_due_date} · {fmt(item.amount)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => postNow(item.id)}
                    disabled={posting === item.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50"
                  >
                    <Play size={11} /> Post
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/recurring'); }}
            className="w-full px-4 py-2.5 text-xs font-semibold text-primary border-t border-white/5 hover:bg-white/5 text-left"
          >
            Open Recurring →
          </button>
        </div>
      )}
    </div>
  );
};
