import React from 'react';
import { X } from 'lucide-react';

const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function BoardModal({ onClose, onCreate }) {
  const [form, setForm] = React.useState({ name: '', description: '', color: '#6366f1' });

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onCreate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-650 transition"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Create Sprint Board</h2>
          <p className="mt-1 text-xs text-slate-400">
            Establish a new track for task cards and AI analysis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Board Name
            </span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Q3 Roadmap"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
            </span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="A brief summary of this track's scope..."
              rows="3"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 resize-none"
            />
          </label>

          <div>
            <span className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Track Theme Color
            </span>
            <div className="grid grid-cols-6 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, color }))}
                  className="btn-active-scale flex h-9 w-full items-center justify-center rounded-lg transition-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                >
                  {form.color === color && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-active-scale rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-active-scale rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 shadow-sm"
            >
              Create Track
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
