import React, { useState } from 'react';

export default function CreateTaskInline({ onSave, onCancel }) {
  const [title, setTitle] = useState('');

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!title.trim()) return;
      onSave(title.trim());
    }

    if (event.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="rounded-2xl border-editorial bg-brand-offwhite p-3.5 shadow-editorial-sm animate-fade-in ring-2 ring-brand-purple/10">
      <input 
        autoFocus 
        value={title} 
        onChange={(event) => setTitle(event.target.value)} 
        onKeyDown={handleKeyDown} 
        placeholder="Name this sprint task..." 
        className="w-full border-none p-0 text-xs font-semibold text-brand-black outline-none placeholder:text-brand-black/30 bg-transparent font-sans-editorial" 
      />
      <div className="mt-2.5 flex items-center justify-between border-t border-brand-black/10 pt-2 text-[9px] font-black text-brand-black/45 uppercase tracking-widest font-sans-editorial">
        <span>Press <span className="text-brand-purple font-black">Enter</span> to save</span>
        <button type="button" onClick={onCancel} className="text-brand-black/60 hover:text-brand-black transition cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}