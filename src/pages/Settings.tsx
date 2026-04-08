import React, { useEffect, useState } from 'react';
import {
  Palette, Tag, Users, Plus, Pencil, Trash2, Check, X,
  Sun, Moon, ChevronRight,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { categoriesApi, CategoryPayload } from '../api/categories';
import { transactionsApi } from '../api/transactions';
import { Category, CategoryType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

// ── Constants ──────────────────────────────────────────────
const CAT_ICONS = [
  '🛒','🍔','🚗','🏠','💊','🎮','✈️','📚','💼','💰',
  '🎁','⚡','📱','🏋️','🎨','🏥','🎵','🍕','🚌','💅',
  '🏫','🐾','🌿','🎭','📦','🏖️','🎓','🔧','🍷','☕',
];
const CAT_COLORS = [
  '#6366f1','#22c55e','#f97316','#ef4444','#3b82f6',
  '#ec4899','#f59e0b','#14b8a6','#8b5cf6','#84cc16',
  '#06b6d4','#f43f5e','#a855f7','#10b981','#fb923c',
];

const DARK   = '#171f33';
const DARK_HI = '#222a3d';
const BORDER  = 'rgba(255,255,255,0.07)';
const TEXT    = '#dae2fd';
const MUTED   = '#6b7280';

type SettingsTab = 'appearance' | 'categories' | 'payees';

const TYPE_OPTIONS: { value: CategoryType; label: string; color: string }[] = [
  { value: 'expense', label: 'Expense', color: '#ffb4ab' },
  { value: 'income',  label: 'Income',  color: '#4edea3' },
  { value: 'both',    label: 'Both',    color: '#8ed5ff' },
];

// ── Category form ──────────────────────────────────────────
interface CatForm { name: string; icon: string; color: string; type: CategoryType }
const emptyCatForm = (): CatForm => ({ name: '', icon: '📦', color: '#6366f1', type: 'expense' });

// ── Settings page ──────────────────────────────────────────
export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<SettingsTab>('appearance');

  // ── Categories state ──────────────────────────────────
  const [categories, setCategories]   = useState<Category[]>([]);
  const [catLoading, setCatLoading]   = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat]   = useState<Category | null>(null);
  const [catForm, setCatForm]         = useState<CatForm>(emptyCatForm());
  const [catSaving, setCatSaving]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [catSearch, setCatSearch]     = useState('');

  // ── Payees state ──────────────────────────────────────
  const [txnPayees, setTxnPayees]       = useState<{ name: string; count: number }[]>([]);
  const [payeesLoading, setPayeesLoading] = useState(false);
  const [customPayees, setCustomPayees]   = useState<string[]>(() =>
    JSON.parse(localStorage.getItem('custom_payees') || '[]')
  );
  const [newPayee, setNewPayee]   = useState('');
  const [payeeSearch, setPayeeSearch] = useState('');

  // ── Load categories ───────────────────────────────────
  useEffect(() => {
    if (tab !== 'categories') return;
    setCatLoading(true);
    categoriesApi.list().then(setCategories).finally(() => setCatLoading(false));
  }, [tab]);

  // ── Load payees ───────────────────────────────────────
  useEffect(() => {
    if (tab !== 'payees') return;
    setPayeesLoading(true);
    transactionsApi.list({ limit: 500 }).then(txns => {
      const map: Record<string, number> = {};
      txns.forEach(t => { if (t.payee) map[t.payee] = (map[t.payee] || 0) + 1; });
      setTxnPayees(
        Object.entries(map)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      );
    }).finally(() => setPayeesLoading(false));
  }, [tab]);

  // ── Category CRUD ─────────────────────────────────────
  const openAddCat = () => {
    setEditingCat(null);
    setCatForm(emptyCatForm());
    setShowCatForm(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, icon: cat.icon, color: cat.color, type: cat.type });
    setShowCatForm(true);
  };

  const cancelCatForm = () => { setShowCatForm(false); setEditingCat(null); };

  const saveCat = async () => {
    if (!catForm.name.trim()) return;
    setCatSaving(true);
    try {
      const payload: CategoryPayload = { ...catForm, name: catForm.name.trim() };
      if (editingCat) {
        const updated = await categoriesApi.update(editingCat.id, payload);
        setCategories(cs => cs.map(c => c.id === editingCat.id ? updated : c));
      } else {
        const created = await categoriesApi.create(payload);
        setCategories(cs => [...cs, created]);
      }
      setShowCatForm(false);
      setEditingCat(null);
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (id: string) => {
    setDeletingId(id);
    try {
      await categoriesApi.delete(id);
      setCategories(cs => cs.filter(c => c.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ── Custom payees ─────────────────────────────────────
  const saveCustomPayees = (list: string[]) => {
    const sorted = [...new Set(list)].sort();
    setCustomPayees(sorted);
    localStorage.setItem('custom_payees', JSON.stringify(sorted));
  };

  const addCustomPayee = () => {
    const name = newPayee.trim();
    if (!name || customPayees.includes(name)) { setNewPayee(''); return; }
    saveCustomPayees([...customPayees, name]);
    setNewPayee('');
  };

  const removeCustomPayee = (name: string) => saveCustomPayees(customPayees.filter(p => p !== name));

  // ── Filtered lists ────────────────────────────────────
  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );
  const filteredTxnPayees = txnPayees.filter(p =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase())
  );
  const filteredCustomPayees = customPayees.filter(p =>
    p.toLowerCase().includes(payeeSearch.toLowerCase())
  );

  // ── Tab button ────────────────────────────────────────
  const TabBtn = ({ id, icon: Icon, label }: { id: SettingsTab; icon: React.FC<any>; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all"
      style={{
        background: tab === id ? 'rgba(142,213,255,0.12)' : 'transparent',
        color: tab === id ? '#8ed5ff' : MUTED,
        border: `1px solid ${tab === id ? 'rgba(142,213,255,0.25)' : 'transparent'}`,
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-20">
      <Header title="Settings" subtitle="Preferences & data management" />

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        <TabBtn id="appearance" icon={Palette} label="Appearance" />
        <TabBtn id="categories" icon={Tag} label="Categories" />
        <TabBtn id="payees" icon={Users} label="Payees" />
      </div>

      {/* ── APPEARANCE ─────────────────────────────────── */}
      {tab === 'appearance' && (
        <div className="space-y-4 max-w-lg">
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-5" style={{ color: TEXT }}>Theme</h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Dark option */}
              <button
                onClick={() => setTheme('dark')}
                className="relative rounded-xl p-4 text-left transition-all"
                style={{
                  background: '#0b1326',
                  border: `2px solid ${theme === 'dark' ? '#8ed5ff' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                {theme === 'dark' && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={11} style={{ color: '#00354a' }} />
                  </div>
                )}
                <Moon size={20} className="mb-3 text-primary" />
                <p className="text-sm font-semibold text-white">Dark</p>
                <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>Easy on the eyes</p>
                {/* Mini preview */}
                <div className="mt-3 rounded-lg overflow-hidden" style={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="h-1.5 w-1/2 rounded-full my-2 mx-2" style={{ background: '#8ed5ff' }} />
                  <div className="h-1 w-3/4 rounded-full mb-2 mx-2" style={{ background: 'rgba(255,255,255,0.12)' }} />
                </div>
              </button>

              {/* Light option */}
              <button
                onClick={() => setTheme('light')}
                className="relative rounded-xl p-4 text-left transition-all"
                style={{
                  background: '#f8fafc',
                  border: `2px solid ${theme === 'light' ? '#8ed5ff' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                {theme === 'light' && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={11} style={{ color: '#00354a' }} />
                  </div>
                )}
                <Sun size={20} className="mb-3" style={{ color: '#3b82f6' }} />
                <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>Light</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>Bright & clean</p>
                {/* Mini preview */}
                <div className="mt-3 rounded-lg overflow-hidden" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="h-1.5 w-1/2 rounded-full my-2 mx-2" style={{ background: '#3b82f6' }} />
                  <div className="h-1 w-3/4 rounded-full mb-2 mx-2" style={{ background: 'rgba(0,0,0,0.1)' }} />
                </div>
              </button>
            </div>
            <p className="text-[11px] mt-4" style={{ color: MUTED }}>
              Note: modals and dropdowns are always dark-themed.
            </p>
          </Card>
        </div>
      )}

      {/* ── CATEGORIES ──────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="space-y-4 max-w-2xl">
          {/* Inline add/edit form */}
          {showCatForm && (
            <Card>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#8ed5ff' }}>
                {editingCat ? 'Edit Category' : 'New Category'}
              </h3>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Name</p>
                  <input
                    autoFocus
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: DARK_HI, color: TEXT, border: `1px solid ${BORDER}` }}
                    placeholder="e.g. Groceries"
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveCat()}
                  />
                </div>

                {/* Type */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Type</p>
                  <div className="flex gap-2">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setCatForm(f => ({ ...f, type: opt.value }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: catForm.type === opt.value ? `${opt.color}22` : DARK_HI,
                          color: catForm.type === opt.value ? opt.color : MUTED,
                          border: `1px solid ${catForm.type === opt.value ? opt.color + '55' : BORDER}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Icon</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setCatForm(f => ({ ...f, icon }))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all"
                        style={{
                          background: catForm.icon === icon ? 'rgba(142,213,255,0.15)' : DARK_HI,
                          border: `1px solid ${catForm.icon === icon ? 'rgba(142,213,255,0.4)' : BORDER}`,
                          fontSize: 16,
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Color</p>
                  <div className="flex flex-wrap gap-2">
                    {CAT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setCatForm(f => ({ ...f, color }))}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{
                          background: color,
                          outline: catForm.color === color ? `3px solid ${color}` : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveCat}
                    disabled={catSaving || !catForm.name.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: '#8ed5ff', color: '#00354a' }}
                  >
                    <Check size={13} />
                    {catSaving ? 'Saving…' : editingCat ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={cancelCatForm}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: DARK_HI, color: MUTED, border: `1px solid ${BORDER}` }}
                  >
                    <X size={13} /> Cancel
                  </button>
                  {/* Live preview */}
                  <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${catForm.color}18` }}>
                    <span style={{ fontSize: 16 }}>{catForm.icon}</span>
                    <span className="text-sm font-medium" style={{ color: catForm.color }}>{catForm.name || 'Preview'}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEXT }}>Categories</h2>
              <div className="flex items-center gap-2">
                <input
                  className="bg-transparent text-xs outline-none px-3 py-1.5 rounded-lg"
                  style={{ color: TEXT, border: `1px solid ${BORDER}`, width: 140 }}
                  placeholder="Search…"
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                />
                <button
                  onClick={openAddCat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(142,213,255,0.1)', color: '#8ed5ff', border: '1px solid rgba(142,213,255,0.25)' }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>

            {catLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredCats.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: MUTED }}>
                {catSearch ? 'No matching categories' : 'No categories yet'}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredCats.map(cat => {
                  const typeOpt = TYPE_OPTIONS.find(t => t.value === cat.type);
                  const isConfirming = confirmDeleteId === cat.id;
                  const isDeleting = deletingId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                      style={{ background: editingCat?.id === cat.id ? 'rgba(142,213,255,0.05)' : 'rgba(255,255,255,0.02)' }}
                    >
                      {/* Color swatch */}
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      {/* Icon */}
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{cat.icon}</span>
                      {/* Name */}
                      <span className="flex-1 text-sm font-medium" style={{ color: TEXT }}>{cat.name}</span>
                      {/* Type badge */}
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${typeOpt?.color ?? '#6b7280'}18`, color: typeOpt?.color ?? '#6b7280' }}
                      >
                        {cat.type}
                      </span>
                      {/* Actions */}
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] mr-1" style={{ color: '#ffb4ab' }}>Delete?</span>
                          <button
                            onClick={() => deleteCat(cat.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded text-[10px] font-semibold"
                            style={{ background: 'rgba(255,100,100,0.15)', color: '#ffb4ab' }}
                          >
                            {isDeleting ? '…' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded text-[10px] font-semibold"
                            style={{ background: DARK_HI, color: MUTED }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
                          <button
                            onClick={() => openEditCat(cat)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: MUTED }}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(cat.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: MUTED }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── PAYEES ─────────────────────────────────────── */}
      {tab === 'payees' && (
        <div className="space-y-4 max-w-xl">
          {/* Custom payees */}
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: TEXT }}>Custom Payees</h2>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              These payees are always available as autocomplete suggestions when adding transactions.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: DARK_HI, color: TEXT, border: `1px solid ${BORDER}` }}
                placeholder="Add payee name…"
                value={newPayee}
                onChange={e => setNewPayee(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomPayee()}
              />
              <button
                onClick={addCustomPayee}
                disabled={!newPayee.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: 'rgba(142,213,255,0.1)', color: '#8ed5ff', border: '1px solid rgba(142,213,255,0.25)' }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            {customPayees.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: MUTED }}>No custom payees yet</p>
            ) : (
              <div className="space-y-1">
                {customPayees
                  .filter(p => p.toLowerCase().includes(payeeSearch.toLowerCase()))
                  .map(name => (
                    <div
                      key={name}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <span className="text-sm" style={{ color: TEXT }}>{name}</span>
                      <button
                        onClick={() => removeCustomPayee(name)}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        style={{ color: MUTED }}
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          {/* Payees from transactions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: TEXT }}>From Transactions</h2>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>Auto-discovered from your transaction history</p>
              </div>
              <input
                className="bg-transparent text-xs outline-none px-3 py-1.5 rounded-lg"
                style={{ color: TEXT, border: `1px solid ${BORDER}`, width: 130 }}
                placeholder="Search…"
                value={payeeSearch}
                onChange={e => setPayeeSearch(e.target.value)}
              />
            </div>

            {payeesLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredTxnPayees.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: MUTED }}>
                {payeeSearch ? 'No matching payees' : 'No transaction payees found'}
              </p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {filteredTxnPayees.map(({ name, count }) => (
                  <div
                    key={name}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} style={{ color: MUTED }} />
                      <span className="text-sm" style={{ color: TEXT }}>{name}</span>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}
                    >
                      {count} txn{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
