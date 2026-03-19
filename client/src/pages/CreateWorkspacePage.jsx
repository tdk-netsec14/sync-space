import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorkspace } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Compass, Layers, Smile, Palette, Eye, Workflow, ArrowRight, Sparkles, Terminal, BarChart2, Briefcase, Users, Timer } from 'lucide-react';
import { motion } from 'framer-motion';

// Curated workspace-related emojis for teams
const emojis = ['💻', '🎨', '📊', '💼', '👥', '⏱️'];
const colors = ['#8B5CF6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#DCC7FF'];

// Mapping workspace categories to gorgeous modern vector line symbols
export const emojiMap = {
  '💻': Terminal,
  '🎨': Palette,
  '📊': BarChart2,
  '💼': Briefcase,
  '👥': Users,
  '⏱️': Timer
};

export default function CreateWorkspacePage() {
  const navigate = useNavigate();
  const { workspaces, reloadWorkspaces, currentWorkspace } = useWorkspace();
  const [form, setForm] = useState({ name: '', description: '', logo: '💻', color: '#8B5CF6' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preview = useMemo(
    () => ({
      name: form.name || 'My workspace',
      description: form.description || 'A precise environment for our product team.',
      logo: form.logo,
      color: form.color
    }),
    [form]
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      const response = await createWorkspace(form);
      await reloadWorkspaces();
      navigate(`/workspace/${response.data.workspace._id}`);
    } catch (submitError) {
      setError(submitError.response?.data?.error || 'Unable to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-offwhite px-6 py-12 text-brand-black md:py-20 overflow-hidden dot-grid flex items-center justify-center font-sans">
      
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start animate-fade-in w-full">
        
        {/* Left Parameter Form block */}
        <form onSubmit={handleSubmit} className="border-editorial bg-white p-6 sm:p-8 shadow-editorial rounded-3xl relative overflow-hidden flex flex-col animate-fade-in">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-yellow" />
          
          <div className="mb-8">
            <div className="flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-brand-purple animate-spin-slow shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-black/45 block font-sans-editorial">Operational Setup</span>
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-black text-brand-black uppercase leading-none mt-1">Create workspace</h1>
            <p className="mt-2 text-xs font-sans-editorial font-bold text-brand-black/45 leading-relaxed">
              Establish a secure, high-fidelity environment for your team.
            </p>
          </div>

          <label className="mb-5 block">
            <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
              <Layers className="h-3.5 w-3.5 text-brand-purple shrink-0" />
              <span>Workspace name</span>
            </span>
            <input 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              placeholder="e.g. Acme engineering"
              className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3.5 text-xs font-bold text-brand-black outline-none transition placeholder:text-brand-black/30 focus:shadow-editorial-sm font-sans-editorial" 
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
              <Compass className="h-3.5 w-3.5 text-brand-purple shrink-0" />
              <span>Description</span>
            </span>
            <textarea 
              name="description" 
              value={form.description} 
              onChange={handleChange} 
              rows="3" 
              placeholder="A brief overview of your team's objective..."
              className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3.5 text-xs font-bold text-brand-black outline-none transition placeholder:text-brand-black/30 focus:shadow-editorial-sm font-sans-editorial resize-none" 
            />
          </label>

          {/* Upgraded Logo preset system (instead of raw emojis) */}
          <div className="mb-5">
            <span className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
              <Smile className="h-3.5 w-3.5 text-brand-purple shrink-0" />
              <span>Workspace Category Identity</span>
            </span>
            <div className="grid grid-cols-6 gap-2.5">
              {emojis.map((emoji) => {
                const VectorIcon = emojiMap[emoji];
                return (
                  <button 
                    key={emoji} 
                    type="button" 
                    onClick={() => setForm((current) => ({ ...current, logo: emoji }))} 
                    className={`btn-active-scale rounded-2xl border py-3 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      form.logo === emoji 
                        ? 'border-brand-black bg-brand-yellow shadow-editorial-sm scale-105' 
                        : 'border-brand-black/10 bg-white hover:border-brand-black hover:bg-brand-beige'
                    }`}
                  >
                    {VectorIcon ? (
                      <VectorIcon className={`h-4.5 w-4.5 transition-colors ${form.logo === emoji ? 'text-brand-black' : 'text-brand-black/40'}`} />
                    ) : (
                      <span className="text-base">{emoji}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <span className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
              <Palette className="h-3.5 w-3.5 text-brand-purple shrink-0" />
              <span>Accent color</span>
            </span>
            <div className="grid grid-cols-6 gap-2.5">
              {colors.map((color) => (
                <button 
                  key={color} 
                  type="button" 
                  onClick={() => setForm((current) => ({ ...current, color }))} 
                  className="btn-active-scale flex h-10 w-full items-center justify-center rounded-xl cursor-pointer transition-transform hover:scale-105 border border-brand-black/10" 
                  style={{ backgroundColor: color }}
                >
                  {form.color === color && (
                    <span className="h-2 w-2 rounded-full bg-white shadow-sm ring-1 ring-brand-black/10" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-5 rounded-2xl border border-rose-500 bg-rose-50 px-4 py-3.5 text-xs font-bold text-rose-700 font-sans-editorial">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-black border-editorial px-5 py-4 text-xs font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 transition disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer shadow-editorial uppercase tracking-widest"
              >
                <span>{isSubmitting ? 'Creating Workspace...' : 'Create Workspace'}</span>
                {!isSubmitting && <ArrowRight className="h-4 w-4 text-brand-yellow shrink-0" />}
              </button>
            </motion.div>

            {workspaces.length > 0 && (
              <motion.button 
                type="button"
                onClick={() => {
                  const targetWorkspace = currentWorkspace || workspaces[0];
                  const id = targetWorkspace.id || targetWorkspace._id;
                  navigate(`/workspace/${id}`);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white border border-brand-black px-5 py-4 text-xs font-editorial font-bold text-brand-black hover:bg-brand-beige transition cursor-pointer shadow-editorial uppercase tracking-widest"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4 text-brand-black shrink-0" />
              </motion.button>
            )}
          </div>
        </form>

        {/* Right Live Preview card */}
        <div className="border-editorial bg-white p-6 sm:p-8 shadow-editorial rounded-3xl relative overflow-hidden flex flex-col justify-between min-h-[350px]">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-purple" />
          
          <div>
            <h2 className="font-editorial text-xs font-bold uppercase tracking-widest text-brand-black/45 mb-6 flex items-center gap-2">
              <Eye className="h-4.5 w-4.5 text-brand-purple shrink-0" />
              <span>Live preview</span>
            </h2>
            
            <div className="relative rounded-3xl border-editorial bg-brand-offwhite/40 p-6 overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-20 -z-10" />
              
              <div className="flex items-start gap-4">
                {/* Dynamically renders matching vector logo inside live preview */}
                <div 
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-brand-black border border-brand-black/15 shadow-sm transition-all" 
                  style={{ backgroundColor: preview.color }}
                >
                  {emojiMap[preview.logo] ? (
                    React.createElement(emojiMap[preview.logo], { className: "h-5 w-5 text-brand-black" })
                  ) : (
                    <span className="text-xl font-bold">{preview.logo || 'S'}</span>
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-editorial text-lg font-bold text-brand-black leading-none uppercase tracking-wide">{preview.name}</h3>
                  <p className="mt-2 text-[9px] font-black text-brand-purple uppercase tracking-widest flex items-center gap-1.5 font-sans-editorial">
                    <Workflow className="h-3.5 w-3.5 text-brand-purple animate-pulse" /> active space
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-brand-black/50 font-sans-editorial font-bold break-words">{preview.description}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-black/10 bg-brand-lavender/10 px-4 py-3.5 text-xs text-brand-black font-sans-editorial font-bold">
            <Sparkles className="h-4.5 w-4.5 shrink-0 text-brand-purple animate-pulse" />
            <span>This workspace identity frames your sidebar menus and canvas indicators.</span>
          </div>
        </div>
      </div>
    </div>
  );
}