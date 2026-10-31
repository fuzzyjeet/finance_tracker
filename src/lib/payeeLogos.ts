import { useEffect, useState } from 'react';
import { logosApi, logoUrl } from '../api/logos';
import { onDataChanged } from './events';

// Which payees have a logo, loaded once and shared by every list that shows payees.
let map: Record<string, string> = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const payeeKey = (payee: string) => payee.trim().toLowerCase().replace(/\s+/g, ' ');

export function reloadPayeeLogos() {
  loading = logosApi.payeeMap()
    .then(m => { map = m; listeners.forEach(l => l()); })
    .catch(() => {});
  return loading;
}

onDataChanged(() => { reloadPayeeLogos(); });

/** Returns a lookup from payee name to its logo's URL (or null). Re-renders when logos change. */
export function usePayeeLogos(): (payee: string | undefined) => string | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    if (!loading) reloadPayeeLogos();
    return () => { listeners.delete(listener); };
  }, []);
  return payee => {
    const key = payee ? map[payeeKey(payee)] : undefined;
    return key ? logoUrl(key) : null;
  };
}
