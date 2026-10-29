import React from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useOffline } from '../../offline/sync';

const plural = (n: number) => `${n} transaction${n > 1 ? 's' : ''}`;

export const OfflineBanner: React.FC = () => {
  const { online, cachedAt, queue, syncing, notice } = useOffline();
  const waiting = queue.filter(q => !q.error).length;
  const failed = queue.length - waiting;

  let icon: React.ReactNode;
  let text: React.ReactNode;
  let tone = '#8ed5ff';

  if (notice) {
    icon = notice.startsWith('Synced') ? <Check size={14} /> : <CloudOff size={14} />;
    text = notice;
  } else if (!online || cachedAt) {
    const since = cachedAt
      ? ` · showing data from ${format(new Date(cachedAt), isToday(new Date(cachedAt)) ? 'HH:mm' : 'd MMM, HH:mm')}`
      : '';
    icon = <CloudOff size={14} />;
    text = <>Offline{since}{waiting > 0 && <> · {plural(waiting)} waiting to sync</>}</>;
    tone = '#fbbf24';
  } else if (waiting > 0) {
    icon = <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />;
    text = syncing ? `Syncing ${plural(waiting)}…` : `${plural(waiting)} waiting to sync`;
  } else if (failed > 0) {
    icon = <AlertTriangle size={14} />;
    text = <>{plural(failed)} couldn't be saved · <Link to="/transactions" className="underline">review</Link></>;
    tone = '#ffb4ab';
  } else {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium shrink-0"
      style={{ color: tone, background: `${tone}1a`, borderBottom: `1px solid ${tone}33` }}
      role="status"
    >
      {icon}
      <span>{text}</span>
    </div>
  );
};
