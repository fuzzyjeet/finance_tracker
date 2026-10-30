import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays, parseISO, isToday, isYesterday } from 'date-fns';
import { Clock, CheckCircle2, CalendarPlus } from 'lucide-react';
import { transactionsApi } from '../../api/transactions';
import { Transaction } from '../../types';
import { onDataChanged } from '../../lib/events';
import { useQuickAdd } from '../../contexts/QuickAddContext';

// How many past days (not counting today) to check for gaps
const GAP_WINDOW = 7;

const fmt = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const dayLabel = (date: string) => {
  const d = parseISO(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM');
};

/** "When did I last log, and which recent days are empty?" — the first thing seen on opening the app. */
export const LogStatus: React.FC = () => {
  const openAdd = useQuickAdd();
  const [latest, setLatest]   = useState<Transaction | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [loaded, setLoaded]   = useState(false);

  const load = useCallback(async () => {
    const today = new Date();
    const from = format(subDays(today, GAP_WINDOW), 'yyyy-MM-dd');
    const [last, recent] = await Promise.all([
      transactionsApi.list({ limit: 1 }),
      transactionsApi.list({ date_from: from, limit: 1000 }),
    ]);
    const logged = new Set(recent.map(t => t.date));
    const gaps: string[] = [];
    for (let i = GAP_WINDOW; i >= 1; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (!logged.has(d)) gaps.push(d);
    }
    setLatest(last[0] ?? null);
    setMissing(gaps);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    return onDataChanged(load);
  }, [load]);

  if (!loaded) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/5 bg-surface-container-low px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Clock size={15} className="text-on-surface-variant shrink-0" />
        {latest ? (
          <p className="text-sm text-on-surface-variant truncate">
            Last entry{' '}
            <span className="font-semibold text-on-surface">
              {dayLabel(latest.date)}{latest.time ? `, ${latest.time}` : ''}
            </span>
            {' · '}{latest.payee} · {fmt(latest.amount)}
          </p>
        ) : (
          <p className="text-sm text-on-surface-variant">Nothing logged yet</p>
        )}
      </div>

      {/* Phones: one horizontally scrolling row instead of wrapping onto many lines */}
      <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto md:flex-wrap overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {missing.length === 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-secondary">
            <CheckCircle2 size={15} /> Every day this week has entries
          </span>
        ) : (
          <>
            <span className="shrink-0 text-sm text-on-surface-variant">No entries on</span>
            {missing.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => openAdd({ date: d })}
                className="shrink-0 whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-yellow-500/30 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                title={`Add a transaction on ${d}`}
              >
                <CalendarPlus size={12} /> {dayLabel(d)}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
