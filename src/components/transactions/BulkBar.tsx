import React, { useState } from 'react';
import { X, Shapes, Tag as TagIcon, FolderOpen, Trash2, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BulkAction } from '../../api/transactions';
import { Category, Project, Tag } from '../../types';

type Picker = 'category' | 'tags' | 'project' | 'delete' | null;

/** Bottom bar shown while transactions are selected, with the actions that apply to all of them. */
export const BulkBar: React.FC<{
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  onApply: (action: BulkAction) => Promise<void>;
  categories: Category[];
  tags: Tag[];
  projects: Project[];
}> = ({ count, allSelected, onToggleAll, onCancel, onApply, categories, tags, projects }) => {
  const [picker, setPicker] = useState<Picker>(null);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const apply = async (action: BulkAction) => {
    setBusy(true);
    try {
      await onApply(action);
      setPicker(null);
      setTagIds(new Set());
    } finally {
      setBusy(false);
    }
  };

  const noun = `${count} ${count === 1 ? 'entry' : 'entries'}`;
  const actions: { key: Exclude<Picker, null>; label: string; icon: React.ReactNode; danger?: boolean }[] = [
    { key: 'category', label: 'Category', icon: <Shapes size={18} /> },
    { key: 'tags', label: 'Tags', icon: <TagIcon size={18} /> },
    { key: 'project', label: 'Project', icon: <FolderOpen size={18} /> },
    { key: 'delete', label: 'Delete', icon: <Trash2 size={18} />, danger: true },
  ];

  const rowCls = 'w-full flex items-center gap-3 px-3 h-12 rounded-xl text-left text-[15px] active:bg-white/5 hover:bg-white/5 disabled:opacity-50';

  return (
    <>
      <div
        className="fixed bulk-bar-position z-40 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[32rem] rounded-2xl shadow-2xl px-3 pt-2 pb-2.5"
        style={{
          background: 'var(--surface-hi)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-xl" aria-label="Stop selecting" style={{ color: 'var(--text-2)' }}>
            <X size={20} />
          </button>
          <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{count} selected</p>
          <button type="button" onClick={onToggleAll} className="h-10 px-3 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {actions.map(a => (
            <button
              key={a.key}
              type="button"
              disabled={count === 0}
              onClick={() => setPicker(a.key)}
              className="flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{
                color: a.danger ? 'var(--expense)' : 'var(--text)',
                background: a.danger ? 'rgb(var(--expense-rgb) / 0.1)' : 'rgba(255,255,255,0.05)',
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <Modal isOpen={picker === 'category'} onClose={() => setPicker(null)} title={`Set category for ${noun}`} size="sm">
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Split entries and transfers keep their own categories.</p>
        <div className="space-y-0.5">
          {[...categories].sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1)).map(c => (
            <button key={c.id} type="button" disabled={busy} className={rowCls} style={{ color: 'var(--text)' }}
              onClick={() => apply({ action: 'update', category_id: c.id })}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={picker === 'tags'} onClose={() => setPicker(null)} title={`Add tags to ${noun}`} size="sm">
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Existing tags stay; these are added.</p>
        {tags.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No tags yet. Create them in Settings.</p>
        ) : (
          <div className="space-y-0.5">
            {tags.map(t => {
              const on = tagIds.has(t.id);
              return (
                <button key={t.id} type="button" className={rowCls} style={{ color: 'var(--text)' }}
                  onClick={() => setTagIds(prev => { const s = new Set(prev); on ? s.delete(t.id) : s.add(t.id); return s; })}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1">{t.name}</span>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid var(--faint-2)', color: 'var(--on-accent)' }}>
                    {on && <Check size={15} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={() => setPicker(null)}>Cancel</Button>
          <Button disabled={tagIds.size === 0} loading={busy} onClick={() => apply({ action: 'update', add_tag_ids: [...tagIds] })}>
            Add {tagIds.size > 0 ? tagIds.size : ''} {tagIds.size === 1 ? 'tag' : 'tags'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={picker === 'project'} onClose={() => setPicker(null)} title={`Add ${noun} to a project`} size="sm">
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Split entries are skipped: set projects on their parts instead.</p>
        {projects.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No projects yet.</p>
        ) : (
          <div className="space-y-0.5">
            {projects.map(p => (
              <button key={p.id} type="button" disabled={busy} className={rowCls} style={{ color: 'var(--text)' }}
                onClick={() => apply({ action: 'update', project_id: p.id })}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${p.color} 15%, transparent)` }}>{p.icon}</span>
                {p.name}
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={picker === 'delete'} onClose={() => setPicker(null)} title={`Delete ${noun}?`} size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
          This can't be undone. Account balances update to match.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPicker(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => apply({ action: 'delete' })}>Delete {noun}</Button>
        </div>
      </Modal>
    </>
  );
};
