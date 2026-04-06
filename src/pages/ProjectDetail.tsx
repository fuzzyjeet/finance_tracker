import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { projectsApi, ProjectSpending } from '../api/projects';
import { ProjectStatus } from '../types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planned: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectSpending | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTxns, setExpandedTxns] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await projectsApi.spending(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string) => {
    if (!id || !data) return;
    await projectsApi.update(id, { status });
    setData(prev => prev ? { ...prev, project: { ...prev.project, status } } : prev);
  };

  const toggleExpand = (txnId: string) => {
    setExpandedTxns(prev => {
      const next = new Set(prev);
      next.has(txnId) ? next.delete(txnId) : next.add(txnId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Project not found.</p>
        <Button className="mt-4" onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  const { project, total_spent, by_category, transactions } = data;
  const budget = project.budget;
  const remaining = budget != null ? budget - total_spent : null;
  const pct = budget && budget > 0 ? (total_spent / budget) * 100 : null;

  return (
    <div>
      <Header
        title={
          <span className="flex items-center gap-2">
            <button onClick={() => navigate('/projects')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <span style={{ color: project.color }}>{project.icon}</span>
            {project.name}
          </span>
        }
        subtitle={project.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[project.status as ProjectStatus]}`}>
              {STATUS_LABELS[project.status as ProjectStatus]}
            </span>
            <Select
              value={project.status}
              onChange={e => handleStatusChange(e.target.value)}
              options={[
                { value: 'planned', label: 'Mark Planned' },
                { value: 'active', label: 'Mark Active' },
                { value: 'completed', label: 'Mark Completed' },
                { value: 'on_hold', label: 'Mark On Hold' },
              ]}
            />
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(total_spent)}</p>
        </Card>
        {budget != null && (
          <>
            <Card>
              <p className="text-xs text-gray-500 mb-1">Budget</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(budget)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${remaining! < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(remaining!)}
              </p>
              {pct != null && (
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              )}
            </Card>
          </>
        )}
        {budget == null && (
          <Card>
            <p className="text-xs text-gray-500 mb-1">Date Range</p>
            <p className="text-sm font-medium text-gray-700">
              {project.start_date
                ? `${project.start_date}${project.end_date ? ` → ${project.end_date}` : ''}`
                : 'No dates set'}
            </p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category breakdown */}
        {by_category.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h3>
            <div className="flex items-center gap-4">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={by_category}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="amount"
                      nameKey="name"
                    >
                      {by_category.map((entry, i) => (
                        <Cell key={i} fill={entry.color !== '#9ca3af' ? entry.color : '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {by_category.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-gray-700">{cat.icon} {cat.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{fmt(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Meta info */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Info</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status as ProjectStatus]}`}>
                  {STATUS_LABELS[project.status as ProjectStatus]}
                </span>
              </dd>
            </div>
            {project.start_date && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Start date</dt>
                <dd className="font-medium text-gray-900">{project.start_date}</dd>
              </div>
            )}
            {project.end_date && (
              <div className="flex justify-between">
                <dt className="text-gray-500">End date</dt>
                <dd className="font-medium text-gray-900">{project.end_date}</dd>
              </div>
            )}
            {project.budget != null && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Budget</dt>
                <dd className="font-medium text-gray-900">{fmt(project.budget)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Transactions</dt>
              <dd className="font-medium text-gray-900">{transactions.length}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Transactions list */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No transactions linked to this project yet
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map(txn => {
              const hasSplits = txn.splits.length > 0;
              const projectSplits = txn.splits.filter(s => s.in_project);
              const expanded = expandedTxns.has(txn.id);

              return (
                <React.Fragment key={txn.id}>
                  <div
                    className={`flex items-center gap-3 py-3 ${hasSplits ? 'cursor-pointer hover:bg-gray-50' : ''} -mx-1 px-1 rounded-lg transition-colors`}
                    onClick={() => hasSplits && toggleExpand(txn.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{txn.payee}</p>
                        {hasSplits && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {projectSplits.length}/{txn.splits.length} splits
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {txn.date}
                        {txn.account_name && ` · ${txn.account_name}`}
                        {txn.category && ` · ${txn.category.icon} ${txn.category.name}`}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${txn.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                      {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                    </span>
                    {hasSplits && (
                      <span className="text-gray-400 shrink-0">
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                  </div>

                  {expanded && hasSplits && (
                    <div className="pb-2 pl-4 space-y-1">
                      {txn.splits.map(split => (
                        <div
                          key={split.id}
                          className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${
                            split.in_project ? 'bg-purple-50 border border-purple-100' : 'opacity-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {split.category ? (
                                <span className="text-xs text-gray-600">{split.category.icon} {split.category.name}</span>
                              ) : (
                                <span className="text-xs text-gray-400">No category</span>
                              )}
                              {split.in_project && (
                                <span className="text-xs text-purple-600 font-medium">· in project</span>
                              )}
                            </div>
                            {split.notes && <p className="text-xs text-gray-400">{split.notes}</p>}
                          </div>
                          <span className="font-medium text-gray-900 shrink-0">{fmt(split.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
