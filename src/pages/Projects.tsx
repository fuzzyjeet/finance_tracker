import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { projectsApi, ProjectPayload } from '../api/projects';
import { Project, ProjectStatus } from '../types';

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

const PROJECT_ICONS = ['📁', '✈️', '🏠', '🎉', '🚗', '💻', '🏋️', '🎓', '🌿', '🛒', '🏥', '🎨', '🔧', '📱', '🌍'];
const PROJECT_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#84cc16'];

interface ProjectForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  budget: string;
}

const emptyForm = (): ProjectForm => ({
  name: '',
  description: '',
  icon: '📁',
  color: '#6366f1',
  status: 'planned',
  start_date: '',
  end_date: '',
  budget: '',
});

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProjects(await projectsApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      icon: p.icon,
      color: p.color,
      status: p.status,
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
      budget: p.budget != null ? p.budget.toString() : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ProjectPayload = {
        name: form.name,
        description: form.description || undefined,
        icon: form.icon,
        color: form.color,
        status: form.status,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
      };
      if (editing) {
        await projectsApi.update(editing.id, payload);
      } else {
        await projectsApi.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await projectsApi.delete(id);
    setDeleteConfirm(null);
    await load();
  };

  return (
    <div>
      <Header
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={<Button onClick={openCreate}><Plus size={16} /> New Project</Button>}
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm mb-3">No projects yet</p>
          <Button onClick={openCreate}><Plus size={16} /> New Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Card
              key={project.id}
              className="relative group cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${project.color}22` }}
                  >
                    {project.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{project.name}</h3>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => openEdit(project, e)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {project.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {project.start_date
                    ? `${project.start_date}${project.end_date ? ` → ${project.end_date}` : ''}`
                    : 'No dates set'}
                </span>
                {project.budget != null && (
                  <span className="font-medium text-gray-600">
                    Budget: €{project.budget.toLocaleString()}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Project' : 'New Project'}
        size="md"
      >
        <div className="space-y-4">
          {/* Icon + Color picker row */}
          <div className="flex items-start gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                {PROJECT_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      form.icon === icon ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-100'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === color ? 'border-gray-700 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${form.color}22` }}>
                  {form.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: form.color }}>{form.name || 'Project name'}</span>
              </div>
            </div>
          </div>

          <Input
            label="Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Berlin Trip 2026"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What is this project about?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <Select
            label="Status"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'on_hold', label: 'On Hold' },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date (optional)"
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              label="End Date (optional)"
              type="date"
              value={form.end_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            />
          </div>

          <Input
            label="Budget (optional)"
            type="number"
            min={0}
            step="0.01"
            value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
            placeholder="0.00"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              {editing ? 'Save Changes' : 'Create Project'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Project" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this project? Transactions will not be deleted.
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
