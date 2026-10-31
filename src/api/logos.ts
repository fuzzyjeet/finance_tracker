import api from './client';

export interface PayeeLogoRow {
  payee: string;          // lower-cased key
  name: string;           // how it's usually written
  count: number;
  last: string;           // date of the latest entry
  domain: string | null;  // chosen or guessed website
  guess: string | null;   // guessed from the name
  logo_key: string | null;
  chosen: boolean;        // the user picked the logo (or no logo)
}

export const logosApi = {
  payees: () => api.get<PayeeLogoRow[]>('/logos/payees').then(r => r.data),
  payeeMap: () => api.get<Record<string, string>>('/logos/payee-map').then(r => r.data),
  fetchAll: () => api.post<{ found: string[]; missing: string[] }>('/logos/payees/fetch').then(r => r.data),
  choose: (payee: string, choice: { domain?: string; logo?: string; none?: boolean }) =>
    api.put<PayeeLogoRow>('/logos/payees', choice, { params: { payee } }).then(r => r.data),
  reset: (payee: string) => api.delete('/logos/payees', { params: { payee } }).then(r => r.data),
};

export const logoUrl = (key: string) => `/api/logos/img/${encodeURIComponent(key)}`;
