import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Bold, Highlighter, Underline, Type, Trash2, X, Loader2, CheckCircle, Globe, Lock } from 'lucide-react';
import { Note, Category } from '../types';

interface NoteViewerProps {
  note: Note;
  notes: Note[]; // All notes in category for navigation
  category: Category;
  isAdmin?: boolean;
  isGuest?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onSaveHighlights?: (content: string) => Promise<void>;
  onNavigate: (note: Note) => void;
  onTogglePublish?: (note: Note, makePublic: boolean) => Promise<void>;
}

export const NoteViewer: React.FC<NoteViewerProps> = ({
  note,
  notes,
  category,
  isAdmin = false,
  isGuest = false,
  onBack,
  onEdit,
  onDelete,
  onSaveHighlights,
  onNavigate,
  onTogglePublish
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangesRef = useRef(false);

  // Swipe state
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Navigation
  const currentIndex = notes.findIndex(n => n.id === note.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < notes.length - 1;
  const prevNote = hasPrev ? notes[currentIndex - 1] : null;
  const nextNote = hasNext ? notes[currentIndex + 1] : null;

  // Save before navigating
  const saveAndNavigate = useCallback(async (targetNote: Note) => {
    if (!isGuest && hasChangesRef.current && contentRef.current && onSaveHighlights) {
      await onSaveHighlights(contentRef.current.innerHTML);
      hasChangesRef.current = false;
    }
    onNavigate(targetNote);
  }, [isGuest, onSaveHighlights, onNavigate]);

  const goToPrev = useCallback(() => {
    if (prevNote) saveAndNavigate(prevNote);
  }, [prevNote, saveAndNavigate]);

  const goToNext = useCallback(() => {
    if (nextNote) saveAndNavigate(nextNote);
  }, [nextNote, saveAndNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) {
        goToPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, goToPrev, goToNext]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only handle horizontal swipes
    if (isHorizontalSwipeRef.current) {
      // Limit swipe range and add resistance at edges
      let newSwipeX = diffX;
      if ((diffX > 0 && !hasPrev) || (diffX < 0 && !hasNext)) {
        newSwipeX = diffX * 0.3; // Resistance at edges
      }
      setSwipeX(Math.max(-150, Math.min(150, newSwipeX)));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    const threshold = 80;

    if (swipeX > threshold && hasPrev) {
      goToPrev();
    } else if (swipeX < -threshold && hasNext) {
      goToNext();
    }

    setSwipeX(0);
    setIsSwiping(false);
    isHorizontalSwipeRef.current = null;
  };

  // Initialize content
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = note.content;
    }
    // Reset swipe state when note changes
    setSwipeX(0);
  }, [note.id, note.content]);

  // Auto-save on unmount if there are changes (only for logged in users)
  useEffect(() => {
    return () => {
      if (!isGuest && hasChangesRef.current && contentRef.current && onSaveHighlights) {
        onSaveHighlights(contentRef.current.innerHTML);
      }
    };
  }, [isGuest, onSaveHighlights]);

  // Check active formats
  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('underline')) formats.add('underline');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === 3 ? container.parentElement : container as Element;
      if (element) {
        const bgColor = window.getComputedStyle(element).backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          formats.add('highlight');
        }
      }
    }
    setActiveFormats(formats);
  }, []);

  // Handle text selection
  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) {
      setShowToolbar(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setShowToolbar(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    setToolbarPosition({
      top: rect.top - containerRect.top - 50,
      left: Math.max(0, Math.min(rect.left - containerRect.left + (rect.width / 2) - 75, containerRect.width - 170))
    });

    checkActiveFormats();
    setShowToolbar(true);
  }, [checkActiveFormats]);

  // Auto-save highlights (only for logged in users)
  const scheduleAutoSave = useCallback(() => {
    if (isGuest || !onSaveHighlights) return;

    hasChangesRef.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (contentRef.current) {
        setIsSaving(true);
        try {
          await onSaveHighlights(contentRef.current.innerHTML);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 1500);
          hasChangesRef.current = false;
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 1000);
  }, [isGuest, onSaveHighlights]);

  // Apply formatting
  const applyFormat = useCallback((command: string) => {
    contentRef.current?.focus();

    if (command === 'highlight') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === 3 ? container.parentElement : container as Element;

        if (element) {
          const bgColor = window.getComputedStyle(element).backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            document.execCommand('hiliteColor', false, 'transparent');
          } else {
            document.execCommand('hiliteColor', false, '#fef08a');
          }
        }
      }
    } else {
      document.execCommand(command, false);
    }

    scheduleAutoSave();
    checkActiveFormats();
  }, [scheduleAutoSave, checkActiveFormats]);

  // Handle image click for zoom
  const handleImageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      setZoomedImage((target as HTMLImageElement).src);
      setIsZoomed(true);
    }
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc muốn xóa ghi chú này?')) {
      onDelete(note.id);
    }
  };

  const handleTogglePublish = async () => {
    if (!onTogglePublish || isTogglingPublish) return;

    const action = note.isPublic ? 'chuyển về riêng tư' : 'công khai';
    if (!confirm(`Bạn có chắc muốn ${action} ghi chú này?`)) return;

    setIsTogglingPublish(true);
    try {
      await onTogglePublish(note, !note.isPublic);
    } catch (error) {
      console.error('Toggle publish error:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const ToolbarButton = ({
    icon: Icon,
    command,
    label,
    isActive
  }: {
    icon: React.ElementType;
    command: string;
    label: string;
    isActive: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        applyFormat(command);
      }}
      className={`p-2.5 rounded-lg transition-all active:scale-95 ${
        isActive
          ? 'bg-brand-100 text-brand-700'
          : 'text-slate-600 hover:bg-slate-100 active:bg-slate-200'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-white relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe indicators */}
      {swipeX !== 0 && (
        <>
          {/* Left indicator (prev) */}
          {swipeX > 0 && hasPrev && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center bg-brand-500 text-white rounded-r-xl transition-all"
              style={{
                width: Math.min(Math.abs(swipeX), 80),
                height: 80,
                opacity: Math.min(Math.abs(swipeX) / 80, 1)
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </div>
          )}
          {/* Right indicator (next) */}
          {swipeX < 0 && hasNext && (
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center bg-brand-500 text-white rounded-l-xl transition-all"
              style={{
                width: Math.min(Math.abs(swipeX), 80),
                height: 80,
                opacity: Math.min(Math.abs(swipeX) / 80, 1)
              }}
            >
              <ChevronRight className="w-6 h-6" />
            </div>
          )}
        </>
      )}

      {/* Main content with swipe transform */}
      <div
        className="flex flex-col h-full transition-transform"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
      {/* Zoom modal */}
      {isZoomed && zoomedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedImage}
            alt="Zoomed"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Save indicator */}
      {(isSaving || showSaved) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
            showSaved ? 'bg-green-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Đang lưu...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Đã lưu</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>

          <div className="flex items-center gap-2">
            {/* Admin publish toggle - only show for notes in public categories */}
            {!isGuest && isAdmin && onTogglePublish && category.isPublic && (
              <button
                onClick={handleTogglePublish}
                disabled={isTogglingPublish}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg active:scale-95 transition-all ${
                  note.isPublic
                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={note.isPublic ? 'Đang công khai - Click để chuyển riêng tư' : 'Đang riêng tư - Click để công khai'}
              >
                {isTogglingPublish ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : note.isPublic ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">
                  {note.isPublic ? 'Public' : 'Private'}
                </span>
              </button>
            )}

            {!isGuest && (
              <>
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 active:scale-95 transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="text-sm font-medium">Sửa</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg active:scale-95 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Category badge */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${category.color}`}></div>
          <span className="text-xs text-slate-500">{category.name}</span>
          <span className="text-xs text-slate-300">•</span>
          <span className="text-xs text-slate-400">
            {new Date(note.updatedAt).toLocaleDateString('vi-VN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          {note.isPublic && (
            <>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Public
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-800 mb-4">{note.title}</h1>

        {/* Image */}
        {note.imageUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
            <img
              src={note.imageUrl}
              alt={note.title}
              className="w-full h-auto object-contain cursor-zoom-in"
              onClick={() => {
                setZoomedImage(note.imageUrl!);
                setIsZoomed(true);
              }}
            />
          </div>
        )}

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {note.tags.map(tag => (
              <span key={tag} className="text-xs bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Content with formatting toolbar */}
        <div className="relative">
          {/* Floating Toolbar - only for logged in users */}
          {!isGuest && showToolbar && (
            <div
              className="absolute z-50 flex items-center gap-1 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 animate-in"
              style={{
                top: `${toolbarPosition.top}px`,
                left: `${toolbarPosition.left}px`,
              }}
            >
              <ToolbarButton
                icon={Bold}
                command="bold"
                label="In đậm"
                isActive={activeFormats.has('bold')}
              />
              <ToolbarButton
                icon={Underline}
                command="underline"
                label="Gạch chân"
                isActive={activeFormats.has('underline')}
              />
              <ToolbarButton
                icon={Highlighter}
                command="highlight"
                label="Highlight"
                isActive={activeFormats.has('highlight')}
              />
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <ToolbarButton
                icon={Type}
                command="removeFormat"
                label="Xóa định dạng"
                isActive={false}
              />
            </div>
          )}

          {/* Content - editable for logged in users, read-only for guests */}
          <div
            ref={contentRef}
            contentEditable={!isGuest}
            suppressContentEditableWarning
            className="prose prose-slate max-w-none text-slate-600 leading-relaxed outline-none
              [&_b]:font-bold [&_strong]:font-bold [&_u]:underline
              [&_img]:rounded-xl [&_img]:cursor-zoom-in"
            onMouseUp={isGuest ? undefined : handleSelection}
            onKeyUp={isGuest ? undefined : handleSelection}
            onClick={handleImageClick}
            onBlur={isGuest ? undefined : () => {
              setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) {
                  setShowToolbar(false);
                }
              }, 200);
            }}
          />
        </div>
      </div>

      {/* Mobile bottom toolbar - only for logged in users */}
      {!isGuest && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-2 flex justify-center gap-2 safe-area-pb">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            className={`p-3 rounded-xl transition-all active:scale-95 ${
              activeFormats.has('bold')
                ? 'bg-brand-100 text-brand-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Bold className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('underline')}
            className={`p-3 rounded-xl transition-all active:scale-95 ${
              activeFormats.has('underline')
                ? 'bg-brand-100 text-brand-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Underline className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('highlight')}
            className={`p-3 rounded-xl transition-all active:scale-95 ${
              activeFormats.has('highlight')
                ? 'bg-yellow-200 text-yellow-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Highlighter className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('removeFormat')}
            className="p-3 rounded-xl bg-slate-100 text-slate-600 transition-all active:scale-95"
          >
            <Type className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Desktop navigation buttons */}
      <div className="hidden md:flex fixed bottom-24 left-1/2 -translate-x-1/2 z-40 gap-4">
        {hasPrev && (
          <button
            onClick={goToPrev}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
            <span className="text-sm text-slate-600">Trước</span>
          </button>
        )}
        {hasNext && (
          <button
            onClick={goToNext}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
          >
            <span className="text-sm text-slate-600">Sau</span>
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {/* Note indicator */}
      {notes.length > 1 && (
        <div className="fixed bottom-28 md:bottom-36 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-slate-100">
            {notes.map((n, idx) => (
              <button
                key={n.id}
                onClick={() => saveAndNavigate(n)}
                className={`w-2 h-2 rounded-full transition-all ${
                  n.id === note.id
                    ? 'bg-brand-500 w-4'
                    : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .safe-area-pb {
          padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }
      `}</style>
      </div>
    </div>
  );
};
