import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { logosApi, logoUrl, PayeeLogoRow } from '../../api/logos';
import { imageToLogo } from '../../lib/bankLogos';
import { reloadPayeeLogos } from '../../lib/payeeLogos';

const SHOWN = 30;

const Tile: React.FC<{ row: PayeeLogoRow }> = ({ row }) => (
  <span
    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden text-sm font-semibold"
    style={{ background: row.logo_key ? 'var(--text)' : 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}
  >
    {row.logo_key
      ? <img src={logoUrl(row.logo_key)} alt="" className="w-full h-full object-contain p-[3px]" loading="lazy" />
      : row.name.trim().charAt(0).toUpperCase()}
  </span>
);

/** Your payees, most used first, with the logo each one shows in lists. */
export const PayeeLogos: React.FC = () => {
  const [rows, setRows] = useState<PayeeLogoRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState('');

  const load = () => logosApi.payees().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const changed = async () => {
    await load();
    reloadPayeeLogos();
  };

  const fetchAll = async () => {
    setFetching(true);
    setResult('');
    try {
      const res = await logosApi.fetchAll();
      setResult(
        `Found ${res.found.length} logo${res.found.length === 1 ? '' : 's'}.`
        + (res.missing.length ? ` None found for ${res.missing.join(', ')}: tap one to type another website or upload an image.` : ''),
      );
      await changed();
    } catch {
      setResult("Couldn't reach the server");
    } finally {
      setFetching(false);
    }
  };

  const withLogo = rows?.filter(r => r.logo_key).length ?? 0;
  const waiting = new Set(rows?.filter(r => r.domain && !r.logo_key).map(r => r.domain)).size;
  const q = search.trim().toLowerCase();
  const matching = (rows ?? []).filter(r => !q || r.name.toLowerCase().includes(q) || r.domain?.includes(q));
  const shown = all || q ? matching : matching.slice(0, SHOWN);

  return (
    <Card>
      <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Payee logos</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
        Logos show next to entries in your lists. Common shops and services in Germany are matched by name, and a
        new one gets its logo the first time you add it. Tap a payee to choose its logo.
      </p>

      {rows && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {withLogo} of {rows.length} payee{rows.length === 1 ? '' : 's'} have a logo
          </p>
          {waiting > 0 && (
            <Button onClick={fetchAll} loading={fetching}>Find {waiting} logo{waiting === 1 ? '' : 's'}</Button>
          )}
        </div>
      )}
      {result && <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>{result}</p>}

      <div className="flex items-center gap-2 h-11 px-3 mt-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Search size={16} style={{ color: 'var(--muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search payees"
          className="flex-1 min-w-0 bg-transparent outline-none text-base"
          style={{ color: 'var(--text)' }}
        />
      </div>

      {!rows ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="mt-2 divide-y divide-white/5">
          {shown.map(r => (
            <PayeeRow key={r.payee} row={r} open={open === r.payee} onToggle={() => setOpen(open === r.payee ? null : r.payee)} onChanged={changed} />
          ))}
          {!q && !all && matching.length > SHOWN && (
            <button type="button" onClick={() => setAll(true)} className="w-full h-11 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Show all {matching.length}
            </button>
          )}
          {shown.length === 0 && <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>No payees match.</p>}
        </div>
      )}
    </Card>
  );
};

const PayeeRow: React.FC<{ row: PayeeLogoRow; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }> = ({ row, open, onToggle, onChanged }) => {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const sub = [
    `${row.count} entr${row.count === 1 ? 'y' : 'ies'}`,
    row.chosen && !row.domain && !row.logo_key ? 'No logo'
      : row.chosen && !row.domain ? 'Your image'
      : row.domain ? `${row.domain}${row.logo_key ? '' : ' · no logo yet'}`
      : 'No website matched',
  ].join(' · ');

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 min-h-[52px] py-1.5 text-left">
        <Tile row={row} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{row.name}</span>
          <span className="block text-xs truncate" style={{ color: 'var(--muted)' }}>{sub}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 transition-transform" style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div className="pb-3 pl-12">
          <div className="flex items-center gap-2">
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && domain.trim()) act(() => logosApi.choose(row.name, { domain })); }}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={row.domain ?? row.guess ?? 'Website, e.g. rewe.de'}
              className="flex-1 min-w-0 h-10 px-3 rounded-lg text-base outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
            />
            <Button variant="secondary" loading={busy}
              disabled={!domain.trim() && !(row.domain ?? row.guess)}
              onClick={() => act(() => logosApi.choose(row.name, { domain: domain.trim() || row.domain || row.guess || '' }))}>
              Find
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 mt-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="h-9 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Upload an image
            </button>
            {!(row.chosen && !row.logo_key && !row.domain) && (
              <button type="button" onClick={() => act(() => logosApi.choose(row.name, { none: true }))} className="h-9 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                No logo
              </button>
            )}
            {row.chosen && (
              <button type="button" onClick={() => act(() => logosApi.reset(row.name))} className="h-9 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                {row.guess ? `Back to ${row.guess}` : 'Reset'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) act(async () => logosApi.choose(row.name, { logo: await imageToLogo(file) }));
            }} />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--expense)' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};
