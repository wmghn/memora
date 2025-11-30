import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Bold, Highlighter, Underline, Type, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Viết nội dung ghi chú ở đây...'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  // Check active formats at cursor position
  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('insertUnorderedList')) formats.add('unorderedList');
    if (document.queryCommandState('insertOrderedList')) formats.add('orderedList');

    // Check for highlight (background color)
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
    if (!selection || selection.isCollapsed || !editorRef.current) {
      setShowToolbar(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setShowToolbar(false);
      return;
    }

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    // Position toolbar above selection
    setToolbarPosition({
      top: rect.top - editorRect.top - 50,
      left: Math.max(0, rect.left - editorRect.left + (rect.width / 2) - 75)
    });

    checkActiveFormats();
    setShowToolbar(true);
  }, [checkActiveFormats]);

  // Apply formatting
  const applyFormat = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();

    if (command === 'highlight') {
      // Toggle highlight
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === 3 ? container.parentElement : container as Element;

        if (element) {
          const bgColor = window.getComputedStyle(element).backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            // Remove highlight
            document.execCommand('hiliteColor', false, 'transparent');
          } else {
            // Add highlight
            document.execCommand('hiliteColor', false, '#fef08a');
          }
        }
      }
    } else {
      document.execCommand(command, false, value);
    }

    // Update content
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }

    checkActiveFormats();
  }, [onChange, checkActiveFormats]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Handle paste - strip formatting option
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormat('bold');
          break;
        case 'u':
          e.preventDefault();
          applyFormat('underline');
          break;
        case 'h':
          e.preventDefault();
          applyFormat('highlight');
          break;
      }
    }
  }, [applyFormat]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.rich-text-toolbar') && !target.closest('.rich-text-editor')) {
        setShowToolbar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="relative rich-text-editor">
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          className="rich-text-toolbar absolute z-50 flex items-center gap-1 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
          }}
        >
          <ToolbarButton
            icon={Bold}
            command="bold"
            label="In đậm (⌘B)"
            isActive={activeFormats.has('bold')}
          />
          <ToolbarButton
            icon={Underline}
            command="underline"
            label="Gạch chân (⌘U)"
            isActive={activeFormats.has('underline')}
          />
          <ToolbarButton
            icon={Highlighter}
            command="highlight"
            label="Highlight (⌘H)"
            isActive={activeFormats.has('highlight')}
          />
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <ToolbarButton
            icon={List}
            command="insertUnorderedList"
            label="Danh sách"
            isActive={activeFormats.has('unorderedList')}
          />
          <ToolbarButton
            icon={ListOrdered}
            command="insertOrderedList"
            label="Danh sách số"
            isActive={activeFormats.has('orderedList')}
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

      {/* Fixed Bottom Toolbar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2 flex justify-center gap-1.5 safe-area-pb overflow-x-auto">
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
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
          className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
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
          className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
            activeFormats.has('highlight')
              ? 'bg-yellow-200 text-yellow-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Highlighter className="w-5 h-5" />
        </button>
        <div className="w-px h-8 bg-slate-200 mx-1 self-center flex-shrink-0" />
        <button
          type="button"
          onClick={() => applyFormat('insertUnorderedList')}
          className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
            activeFormats.has('unorderedList')
              ? 'bg-brand-100 text-brand-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <List className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat('insertOrderedList')}
          className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
            activeFormats.has('orderedList')
              ? 'bg-brand-100 text-brand-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <ListOrdered className="w-5 h-5" />
        </button>
        <div className="w-px h-8 bg-slate-200 mx-1 self-center flex-shrink-0" />
        <button
          type="button"
          onClick={() => applyFormat('removeFormat')}
          className="p-2.5 rounded-xl bg-slate-100 text-slate-600 transition-all active:scale-95 flex-shrink-0"
        >
          <Type className="w-5 h-5" />
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="w-full min-h-[50vh] md:min-h-[60vh] pb-20 md:pb-0 text-slate-600 leading-relaxed text-base outline-none bg-transparent prose prose-slate max-w-none
          [&_b]:font-bold [&_strong]:font-bold
          [&_u]:underline
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
          [&_li]:my-1
          focus:outline-none"
        onInput={handleInput}
        onSelect={handleSelection}
        onMouseUp={handleSelection}
        onKeyUp={(e) => {
          handleSelection();
          checkActiveFormats();
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          // Delay to allow toolbar click
          setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
              setShowToolbar(false);
            }
          }, 200);
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder */}
      <style>{`
        .rich-text-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        .safe-area-pb {
          padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in-95 {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
        .animate-in {
          animation: fade-in 150ms ease-out, zoom-in-95 150ms ease-out;
        }
      `}</style>
    </div>
  );
};
