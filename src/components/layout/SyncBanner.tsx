import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, AlertCircle, X } from 'lucide-react';
import { QueuedTransaction, getQueue, onQueueChanged, flushQueue, discardQueued } from '../../lib/offlineQueue';

const fmt = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** Shows when offline or when entries saved offline are still waiting to reach the server. */
export const SyncBanner: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue]   = useState<QueuedTransaction[]>(getQueue);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const off = onQueueChanged(() => setQueue(getQueue()));
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      off();
    };
  }, []);

  if (online && queue.length === 0) return null;

  const syncNow = async () => {
    setSyncing(true);
    try { await flushQueue(); } finally { setSyncing(false); }
  };

  const waiting = queue.length;
  return (
    <div className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {online ? <RefreshCw size={15} className={`text-warn shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                : <CloudOff size={15} className="text-warn shrink-0" />}
        <p className="flex-1 text-sm text-on-surface">
          {!online && waiting === 0 && "You're offline. New transactions will be saved on this phone and synced later."}
          {!online && waiting > 0 && `Offline · ${waiting} ${waiting === 1 ? 'entry' : 'entries'} saved on this phone, will sync when you're back online`}
          {online && waiting > 0 && `${waiting} ${waiting === 1 ? 'entry' : 'entries'} waiting to sync`}
        </p>
        {online && waiting > 0 && (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-warn border border-warn/30 disabled:opacity-50"
          >
            Sync now
          </button>
        )}
      </div>

      {waiting > 0 && (
        <ul className="mt-2 space-y-1.5">
          {queue.map(q => (
            <li key={q.id} className="flex items-center gap-2 text-xs">
              {q.error && <AlertCircle size={12} className="text-error shrink-0" />}
              <span className="flex-1 min-w-0 truncate text-on-surface-variant">
                {q.payload.date} · {q.payload.payee} · {fmt(q.payload.amount)}
                {q.error && <span className="text-error"> — {q.error}</span>}
              </span>
              {q.error && (
                <button
                  type="button"
                  onClick={() => discardQueued(q.id)}
                  className="shrink-0 p-1 text-on-surface-variant"
                  aria-label="Discard entry"
                  title="Discard"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
