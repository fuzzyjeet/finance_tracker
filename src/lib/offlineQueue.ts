// New transactions saved without a connection wait here (on this device) and are sent
// when the connection comes back. Each one carries its own id, and the server ignores a
// create whose id it already has, so retrying after a lost response never duplicates.
import axios from 'axios';
import { transactionsApi, TransactionPayload } from '../api/transactions';
import { emitDataChanged } from './events';

export interface QueuedTransaction {
  id: string;
  payload: TransactionPayload & { id: string };
  queuedAt: string;
  /** Set when the server rejected it (e.g. a deleted account); it stays until retried or discarded */
  error?: string;
}

const QUEUE_KEY = 'offline_txn_queue';
const QUEUE_CHANGED = 'finance:queue-changed';

const read = (): QueuedTransaction[] => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};

const write = (items: QueuedTransaction[]) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(QUEUE_CHANGED));
};

export const getQueue = read;

export const onQueueChanged = (cb: () => void) => {
  window.addEventListener(QUEUE_CHANGED, cb);
  return () => window.removeEventListener(QUEUE_CHANGED, cb);
};

/** No response at all: offline, DNS failure, server unreachable. */
export const isNetworkError = (err: unknown) => axios.isAxiosError(err) && !err.response;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Creates a transaction, or queues it if the device is offline. */
export async function createTransaction(payload: TransactionPayload): Promise<{ queued: boolean }> {
  const withId = { ...payload, id: newId() };
  if (navigator.onLine === false) {
    enqueue(withId);
    return { queued: true };
  }
  try {
    await transactionsApi.create(withId);
    return { queued: false };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueue(withId);
    return { queued: true };
  }
}

const enqueue = (payload: TransactionPayload & { id: string }) =>
  write([...read(), { id: payload.id, payload, queuedAt: new Date().toISOString() }]);

export const discardQueued = (id: string) => write(read().filter(q => q.id !== id));

let flushing = false;

/** Sends queued transactions in order; stops at the first network failure. */
export async function flushQueue() {
  if (flushing || navigator.onLine === false) return;
  const items = read();
  if (items.length === 0) return;
  flushing = true;
  let sent = 0;
  try {
    for (const item of items) {
      try {
        await transactionsApi.create(item.payload);
        write(read().filter(q => q.id !== item.id));
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break;
        const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
        write(read().map(q => q.id === item.id
          ? { ...q, error: typeof detail === 'string' ? detail : 'The server rejected this entry' }
          : q));
      }
    }
  } finally {
    flushing = false;
    if (sent > 0) emitDataChanged();
  }
}

/** Retries whenever the connection or the app comes back, and every 30s while anything waits. */
export function startQueueSync() {
  const tryFlush = () => { flushQueue(); };
  window.addEventListener('online', tryFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryFlush();
  });
  setInterval(() => { if (read().some(q => !q.error)) tryFlush(); }, 30_000);
  tryFlush();
}
