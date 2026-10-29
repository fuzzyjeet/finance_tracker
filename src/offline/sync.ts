import { useSyncExternalStore } from 'react';
import axios, { AxiosError } from 'axios';
import api from '../api/client';
import type { TransactionPayload } from '../api/transactions';

// Offline support: tracks connectivity, whether shown data came from the
// service worker's cache, and a queue of transactions created while offline.

export interface QueuedTransaction {
  payload: TransactionPayload & { id: string };
  queuedAt: string;
  error?: string; // set when the server rejected it, so it is not retried
}

interface OfflineState {
  online: boolean;
  cachedAt: string | null; // server time of the oldest cached response on screen
  queue: QueuedTransaction[];
  syncing: boolean;
  refreshKey: number; // bumps when pages should reload: after a sync, or on reconnecting
  notice: string | null;
}

const QUEUE_KEY = 'offline_txn_queue';

function readQueue(): QueuedTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

let state: OfflineState = {
  online: navigator.onLine,
  cachedAt: null,
  queue: readQueue(),
  syncing: false,
  refreshKey: 0,
  notice: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<OfflineState>) {
  state = { ...state, ...patch };
  if (patch.queue) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(patch.queue)); } catch { /* storage full or blocked */ }
  }
  listeners.forEach(l => l());
}

export function useOffline(): OfflineState {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

/** True when the request never got a response (no connection, server unreachable, timeout). */
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response && err.code !== AxiosError.ERR_CANCELED;
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
  );
}

export function enqueueTransaction(payload: TransactionPayload & { id: string }) {
  setState({
    queue: [...state.queue, { payload, queuedAt: new Date().toISOString() }],
    online: false,
  });
}

export function discardQueued(id: string) {
  setState({ queue: state.queue.filter(q => q.payload.id !== id) });
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function showNotice(notice: string) {
  clearTimeout(noticeTimer);
  setState({ notice });
  noticeTimer = setTimeout(() => setState({ notice: null }), 4000);
}

/** Sends queued transactions in order. The server ignores ids it already has, so resending is safe. */
export async function flushQueue(): Promise<number> {
  if (state.syncing || !state.queue.some(q => !q.error)) return 0;
  setState({ syncing: true });
  let sent = 0;
  try {
    for (const item of state.queue) {
      if (item.error) continue;
      try {
        await api.post('/transactions', item.payload, { timeout: 15000 });
        setState({ queue: state.queue.filter(q => q.payload.id !== item.payload.id), online: true });
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break; // still offline; try again later
        const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
        const error = typeof detail === 'string' ? detail : 'The server rejected this transaction';
        setState({ queue: state.queue.map(q => q.payload.id === item.payload.id ? { ...q, error } : q) });
      }
    }
  } finally {
    setState({ syncing: false });
  }
  if (sent > 0) {
    setState({ refreshKey: state.refreshKey + 1 });
    showNotice(`Synced ${sent} transaction${sent > 1 ? 's' : ''}`);
  }
  return sent;
}

export function startOfflineSync() {
  api.interceptors.response.use(
    response => {
      if (response.config.method === 'get') {
        if (response.headers['x-from-cache']) {
          const servedAt = response.headers['date'] ? new Date(response.headers['date']).toISOString() : null;
          if (servedAt && (!state.cachedAt || servedAt < state.cachedAt)) {
            setState({ cachedAt: servedAt, online: false });
          }
        } else if (state.cachedAt || !state.online) {
          setState({ cachedAt: null, online: true });
        }
      }
      return response;
    },
    err => {
      if (isNetworkError(err)) {
        // Queued creates are reported by the caller; anything else that changes data needs a connection
        const isQueueable = err.config?.method === 'post' && err.config?.url === '/transactions';
        if (err.config?.method !== 'get' && !isQueueable) {
          showNotice("You're offline. Only adding transactions works without a connection.");
        }
        if (state.online) setState({ online: false });
      }
      return Promise.reject(err);
    },
  );

  window.addEventListener('online', async () => {
    const wasStale = !!state.cachedAt;
    setState({ online: true, cachedAt: null });
    const sent = await flushQueue();
    if (!sent && wasStale) setState({ refreshKey: state.refreshKey + 1 }); // replace the saved data on screen
  });
  window.addEventListener('offline', () => setState({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
  // navigator.onLine can claim a connection that doesn't work, so keep retrying while items wait
  setInterval(() => { if (document.visibilityState === 'visible') flushQueue(); }, 30000);
  flushQueue();
}
