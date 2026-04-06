import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { budgetsApi, BudgetPayload } from '../api/budgets';
import { categoriesApi } from '../api/categories';
import { projectsApi } from '../api/projects';
import { Budget, Category, Project } from '../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

interface BudgetForm {
  category_id: string;
  amount: string;
}

const emptyForm: BudgetForm = { category_id: '', amount: '' };

export const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // IDs of projects whose transactions ARE included in budget spending
  // undefined means not yet loaded; once projects load, defaults to all selected
  const [includedProjectIds, setIncludedProjectIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const currentMonth = format(currentDate, 'yyyy-MM');

  // Load projects once on mount; default all to included
  useEffect(() => {
    projectsApi.list().then(projs => {
      setProjects(projs);
      setIncludedProjectIds(projs.map(p => p.id));
    });
  }, []);

  // Reload budgets whenever month or included-project selection changes
  useEffect(() => {
    if (includedProjectIds === null) return; // not yet initialised
    const excludedIds = projects.map(p => p.id).filter(id => !includedProjectIds.includes(id));
    setLoading(true);
    Promise.all([
      budgetsApi.list(currentMonth, excludedIds),
      categoriesApi.list(),
    ]).then(([buds, cats]) => {
      setBudgets(buds);
      setCategories(cats.filter(c => c.type === 'expense' || c.type === 'both'));
    }).finally(() => setLoading(false));
  }, [currentMonth, includedProjectIds?.join(',')]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setForm({ category_id: budget.category_id, amount: budget.amount.toString() });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BudgetPayload = {
        category_id: form.category_id,
        amount: parseFloat(form.amount),
        month: currentMonth,
      };
      if (editing) {
        await budgetsApi.update(editing.id, { amount: payload.amount, month: payload.month });
      } else {
        await budgetsApi.create(payload);
      }
      setModalOpen(false);
      // Trigger re-load by toggling a dummy dep — simplest approach is to re-fire the effect
      setIncludedProjectIds(prev => prev ? [...prev] : prev);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await budgetsApi.delete(id);
    setDeleteConfirm(null);
    setIncludedProjectIds(prev => prev ? [...prev] : prev);
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);

  const usedCategoryIds = new Set(budgets.map(b => b.category_id));
  const availableCategories = categories.filter(
    c => !usedCategoryIds.has(c.id) || (editing && c.id === editing.category_id)
  );

  return (
    <div>
      <Header
        title="Budgets"
        subtitle={`${format(currentDate, 'MMMM yyyy')} · ${formatCurrency(totalSpent)} of ${formatCurrency(totalBudgeted)} spent`}
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Budget</Button>}
      />

      {/* Month Navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setCurrentDate(d => subMonths(d, 1))}
          className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-on-surface-variant transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-headline text-base font-semibold text-white min-w-[140px] text-center">
          {format(currentDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentDate(d => addMonths(d, 1))}
          className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-on-surface-variant transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Project filter — include mode (all selected by default) */}
      {projects.length > 0 && includedProjectIds !== null && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Include projects:</span>
          {projects.map(p => {
            const included = includedProjectIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setIncludedProjectIds(prev =>
                  prev
                    ? included
                      ? prev.filter(id => id !== p.id)
                      : [...prev, p.id]
                    : [p.id]
                )}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                  included ? 'border-current' : 'border-transparent opacity-40'
                }`}
                style={{ backgroundColor: `${p.color}22`, color: p.color }}
              >
                {p.icon} {p.name}
              </button>
            );
          })}
          {includedProjectIds.length < projects.length && (
            <button
              onClick={() => setIncludedProjectIds(projects.map(p => p.id))}
              className="text-xs text-slate-500 hover:text-on-surface-variant underline"
            >
              Select all
            </button>
          )}
        </div>
      )}

      {/* Summary bar */}
      {budgets.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Overall Budget</span>
            <span className="text-xs text-slate-500">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}
            </span>
          </div>
          <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalBudgeted > 0 && totalSpent / totalBudgeted > 1
                  ? 'bg-error'
                  : totalBudgeted > 0 && totalSpent / totalBudgeted > 0.75
                  ? 'bg-yellow-400'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0)}%` }}
            />
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm mb-3">No budgets for this month</p>
          <Button onClick={openCreate}><Plus size={16} /> Add Budget</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(budget => {
            const spent = budget.spent ?? 0;
            const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const over = pct > 100;
            const warning = pct > 75 && pct <= 100;
            const barColor = over ? 'bg-error' : warning ? 'bg-yellow-400' : 'bg-secondary';
            const textColor = over ? 'text-error' : warning ? 'text-yellow-400' : 'text-secondary';

            return (
              <Card
                key={budget.id}
                className="relative group cursor-pointer hover:border-white/10 transition-colors"
                onClick={() => navigate(`/transactions?category_id=${budget.category_id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: budget.category ? `${budget.category.color}22` : 'rgba(255,255,255,0.05)' }}
                    >
                      {budget.category?.icon ?? '📦'}
                    </div>
                    <div>
                      <p className="font-headline font-semibold text-white text-sm">
                        {budget.category?.name ?? 'Unknown'}
                      </p>
                      <p className={`text-xs font-medium ${textColor}`}>
                        {pct.toFixed(0)}% used
                        {over && ' · Over budget!'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(budget); }}
                      className="p-1.5 text-slate-500 hover:text-on-surface hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(budget.id); }}
                      className="p-1.5 text-slate-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Spent: <span className="font-medium text-on-surface">{formatCurrency(spent)}</span>
                  </span>
                  <span className="text-slate-500">
                    Budget: <span className="font-medium text-on-surface">{formatCurrency(budget.amount)}</span>
                  </span>
                </div>

                {over && (
                  <div className="mt-2 px-2 py-1 bg-error/10 rounded-lg text-xs text-error font-medium">
                    Over by {formatCurrency(spent - budget.amount)}
                  </div>
                )}
                {!over && (
                  <div className="mt-2 text-xs text-slate-500">
                    {formatCurrency(budget.amount - spent)} remaining
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Budget' : 'Add Budget'}
        size="sm"
      >
        <div className="space-y-4">
          {!editing && (
            <Select
              label="Category"
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              options={availableCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
              placeholder="Select category"
            />
          )}
          {editing && (
            <div>
              <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1">Category</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-highest border border-white/10 rounded-lg">
                <span>{editing.category?.icon}</span>
                <span className="text-sm text-on-surface">{editing.category?.name}</span>
              </div>
            </div>
          )}
          <Input
            label="Monthly Budget Amount"
            type="number"
            min={0}
            step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.amount || (!editing && !form.category_id)}
            >
              {editing ? 'Save Changes' : 'Create Budget'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Budget"
        size="sm"
      >
        <p className="text-sm text-on-surface-variant mb-4">
          Are you sure you want to delete this budget?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};
