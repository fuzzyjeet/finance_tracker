import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays, parseISO, isToday, isYesterday } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { transactionsApi } from '../../api/transactions';
import { onDataChanged } from '../../lib/events';
import { useQuickAdd } from '../../contexts/QuickAddContext';

// The last 7 days counting today; today itself isn't flagged since it isn't over
const GAP_WINDOW = 6;

const dayLabel = (date: string) => {
  const d = parseISO(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM');
};

/** Recent days with no entries, each a shortcut to backfill that day. Hidden when nothing is missing. */
export const LogStatus: React.FC = () => {
  const openAdd = useQuickAdd();
  const [missing, setMissing] = useState<string[]>([]);
  const [loaded, setLoaded]   = useState(false);

  const load = useCallback(async () => {
    const today = new Date();
    const from = format(subDays(today, GAP_WINDOW), 'yyyy-MM-dd');
    const recent = await transactionsApi.list({ date_from: from, limit: 1000 });
    const logged = new Set(recent.map(t => t.date));
    const gaps: string[] = [];
    for (let i = GAP_WINDOW; i >= 1; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (!logged.has(d)) gaps.push(d);
    }
    setMissing(gaps);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    return onDataChanged(load);
  }, [load]);

  if (!loaded || missing.length === 0) return null;

  return (
    // Phones: one horizontally scrolling row instead of wrapping onto many lines
    <div className="mb-4 flex items-center gap-2 overflow-x-auto md:flex-wrap rounded-xl border border-white/5 bg-surface-container-low px-4 py-3">
      <span className="shrink-0 text-sm text-on-surface-variant">No entries on</span>
      {missing.map(d => (
        <button
          key={d}
          type="button"
          onClick={() => openAdd({ date: d })}
          className="shrink-0 whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-warn/30 bg-warn/10 text-warn hover:bg-warn/20 transition-colors"
          title={`Add a transaction on ${d}`}
        >
          <CalendarPlus size={12} /> {dayLabel(d)}
        </button>
      ))}
    </div>
  );
};
