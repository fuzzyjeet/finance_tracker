import React, { useEffect, useState } from 'react';
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
import { Budget, Category } from '../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

interface BudgetForm {
  category_id: string;
  amount: string;
}

const emptyForm: BudgetForm = { category_id: '', amount: '' };

export const Budgets: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const currentMonth = format(currentDate, 'yyyy-MM');

  const load = async () => {
    setLoading(true);
    try {
      const [buds, cats] = await Promise.all([
        budgetsApi.list(currentMonth),
        categoriesApi.list(),
      ]);
      setBudgets(buds);
      setCategories(cats.filter(c => c.type === 'expense' || c.type === 'both'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentMonth]);

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
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await budgetsApi.delete(id);
    setDeleteConfirm(null);
    await load();
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);

  // Categories that don't already have a budget this month
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
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-semibold text-gray-900 min-w-[140px] text-center">
          {format(currentDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentDate(d => addMonths(d, 1))}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Summary bar */}
      {budgets.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Budget</span>
            <span className="text-sm text-gray-500">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalBudgeted > 0 && totalSpent / totalBudgeted > 1
                  ? 'bg-red-500'
                  : totalBudgeted > 0 && totalSpent / totalBudgeted > 0.75
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0)}%` }}
            />
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-3">No budgets for this month</p>
          <Button onClick={openCreate}><Plus size={16} /> Add Budget</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(budget => {
            const spent = budget.spent ?? 0;
            const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const over = pct > 100;
            const warning = pct > 75 && pct <= 100;
            const barColor = over ? 'bg-red-500' : warning ? 'bg-yellow-500' : 'bg-green-500';
            const textColor = over ? 'text-red-600' : warning ? 'text-yellow-600' : 'text-green-600';

            return (
              <Card key={budget.id} className="relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: budget.category ? `${budget.category.color}22` : '#f3f4f6' }}
                    >
                      {budget.category?.icon ?? '📦'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
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
                      onClick={() => openEdit(budget)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(budget.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Spent: <span className="font-medium text-gray-900">{formatCurrency(spent)}</span>
                  </span>
                  <span className="text-gray-500">
                    Budget: <span className="font-medium text-gray-900">{formatCurrency(budget.amount)}</span>
                  </span>
                </div>

                {over && (
                  <div className="mt-2 px-2 py-1 bg-red-50 rounded-lg text-xs text-red-600 font-medium">
                    Over by {formatCurrency(spent - budget.amount)}
                  </div>
                )}
                {!over && (
                  <div className="mt-2 text-xs text-gray-400">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <span>{editing.category?.icon}</span>
                <span className="text-sm text-gray-900">{editing.category?.name}</span>
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
        <p className="text-sm text-gray-600 mb-4">
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
