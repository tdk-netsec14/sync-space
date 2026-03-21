import React from 'react';
import { Plus, ListTodo } from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';

export default function KanbanColumn({ column, children, onAddTask, isCreatingTask }) {
  return (
    <Droppable droppableId={String(column.id)}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex w-[310px] shrink-0 flex-col rounded-3xl border-editorial bg-white p-5 shadow-editorial max-h-[78vh] transition-all duration-300 ${
            snapshot.isDraggingOver 
              ? 'bg-brand-lavender/10 border-brand-purple shadow-editorial-hover' 
              : 'border-brand-black hover:shadow-editorial-hover'
          }`}
        >
          {/* Column Header */}
          <div className="mb-4 flex items-center justify-between border-b border-brand-black/10 pb-3">
            <div className="min-w-0">
              <h3 className="truncate font-editorial text-sm font-bold tracking-tight text-brand-black uppercase">
                {column.name}
              </h3>
              <div className="mt-1 flex items-center gap-1">
                <span className="rounded-full bg-brand-beige border border-brand-black/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-black/60">
                  {column.tasks?.length || 0} items
                </span>
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={onAddTask} 
              className="rounded-full border border-brand-black/15 bg-brand-offwhite p-1.5 text-brand-black hover:border-brand-black hover:bg-brand-yellow transition cursor-pointer shadow-sm"
              title="Add task to column"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Draggable Drop Zone */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-2 scrollbar-elegant min-h-[150px]">
            {children}
            {!column.tasks?.length && !isCreatingTask && (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-brand-black/20 bg-brand-offwhite/50">
                <ListTodo className="h-5 w-5 text-brand-black/30" />
                <p className="mt-2 text-[9px] font-editorial font-bold text-brand-black/40 uppercase tracking-widest">
                  Empty canvas
                </p>
              </div>
            )}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}