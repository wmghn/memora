import React, { useState, useRef } from 'react';
import { Pencil, Trash2, Eye, Globe } from 'lucide-react';
import { Note } from '../types';

interface SwipeableNoteCardProps {
  note: Note;
  onView: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export const SwipeableNoteCard: React.FC<SwipeableNoteCardProps> = ({
  note,
  onView,
  onEdit,
  onDelete
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = -80;
  const MAX_SWIPE = -100;

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const diff = e.touches[0].clientX - startXRef.current;
    let newTranslate = currentXRef.current + diff;

    // Limit swipe range
    if (newTranslate > 0) newTranslate = 0;
    if (newTranslate < MAX_SWIPE) newTranslate = MAX_SWIPE;

    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    if (translateX < DELETE_THRESHOLD) {
      // Show delete button
      setTranslateX(MAX_SWIPE);
    } else {
      // Reset position
      setTranslateX(0);
    }
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc muốn xóa ghi chú này?')) {
      // Animate out
      if (cardRef.current) {
        cardRef.current.style.transition = 'all 0.3s ease-out';
        cardRef.current.style.transform = 'translateX(-100%)';
        cardRef.current.style.opacity = '0';
        cardRef.current.style.height = '0';
        cardRef.current.style.marginBottom = '0';
        cardRef.current.style.padding = '0';
      }
      setTimeout(() => {
        onDelete(note.id);
      }, 300);
    } else {
      setTranslateX(0);
    }
  };

  // Strip HTML tags for preview
  const getPlainText = (html: string) => {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150);
  };

  return (
    <div ref={cardRef} className="relative overflow-hidden rounded-xl mb-3">
      {/* Delete button background (revealed on swipe) */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center rounded-r-xl">
        <button
          onClick={handleDelete}
          className="flex flex-col items-center text-white p-2"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-xs mt-1">Xóa</span>
        </button>
      </div>

      {/* Main card content */}
      <div
        className="relative bg-white p-4 border border-slate-100 shadow-sm transition-transform rounded-xl cursor-pointer"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onView(note)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-800 line-clamp-1 flex-1">{note.title}</h3>
          <div className="flex items-center gap-2 ml-2">
            {note.isPublic && (
              <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" />
              </span>
            )}
            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full whitespace-nowrap">
              {new Date(note.updatedAt).toLocaleDateString('vi-VN')}
            </span>

            {/* Edit button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 active:scale-95 transition-all"
              title="Chỉnh sửa"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Delete button - visible on desktop */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="hidden md:block p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all"
              title="Xóa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content with optional thumbnail */}
        <div className="flex gap-3">
          {/* Thumbnail */}
          {note.imageUrl && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
              <img
                src={note.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 line-clamp-2 mb-2 font-light">
              {getPlainText(note.content)}
            </p>

            {note.tags && note.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {note.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-md font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Swipe hint for mobile - show on first render */}
        <div className="md:hidden absolute bottom-1 right-2 text-[10px] text-slate-300">
          ← vuốt để xóa
        </div>
      </div>
    </div>
  );
};
