import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function BoardModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setError('');
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (isSubmitting) return; // prevent double-submit

    setIsSubmitting(true);
    setError('');

    try {
      await onCreate(form);
      // onCreate closes the modal on success
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create the sprint board. Please try again.';
      setError(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-650 transition disabled:opacity-40"
        >
          <X className="h-4 w-4" />
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
              disabled={isSubmitting}
              placeholder="e.g. Q3 Roadmap"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
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
              disabled={isSubmitting}
              placeholder="A brief summary of this track's scope..."
              rows="3"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 resize-none disabled:opacity-60"
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
                  disabled={isSubmitting}
                  onClick={() => setForm((current) => ({ ...current, color }))}
                  className="flex h-9 w-full items-center justify-center rounded-lg transition-transform hover:scale-105 disabled:opacity-60"
                  style={{ backgroundColor: color }}
                >
                  {form.color === color && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-700 font-medium">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Track'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
