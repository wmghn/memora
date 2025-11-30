import React, { useState, useEffect } from 'react';
import { Category, Note, ViewState } from './types';
import { Plus, LayoutGrid, Search, MoreVertical, Loader2, Settings } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AIContextProvider, useAI } from './contexts/AIContext';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { AdminSetupView } from './views/AdminSetupView';
import { SettingsView } from './views/SettingsView';
import * as dbService from './services/dbService';

// Re-importing UI components
import {
  ChevronLeft, Sparkles, Image as ImageIcon, Camera,
  Trash2, Pencil, X, Check, CheckCircle, Globe, Lock, Loader2 as Loader2Icon,
  Bot, ChevronDown
} from 'lucide-react';
import { AIProviderType } from './services/ai/types';
import { IconRenderer } from './components/IconRenderer';
import { RichTextEditor } from './components/RichTextEditor';
import { SwipeableNoteCard } from './components/SwipeableNoteCard';
import { NoteViewer } from './components/NoteViewer';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// --- Re-implemented Views (Stateless) ---

const CategoryDetail = ({
  category,
  notes,
  onBack,
  onViewNote,
  onEditNote,
  onDeleteNote,
  onSearch,
  onEditCategory,
  isGuest = false
}: {
  category: Category;
  notes: Note[];
  onBack: () => void;
  onViewNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
  onSearch: (q: string) => void;
  onEditCategory: (cat: Category) => void;
  isGuest?: boolean;
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className={`sticky top-0 z-10 px-4 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold flex-1">{category.name}</h1>
          {!isGuest && (
            <button onClick={() => onEditCategory(category)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
              <Pencil className="w-5 h-5" />
            </button>
          )}
          <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm ghi chú..." 
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <LayoutGrid className="w-12 h-12 mb-2 opacity-20" />
            <p>Chưa có ghi chú nào</p>
          </div>
        ) : (
          notes.map((note) => (
            <SwipeableNoteCard
              key={note.id}
              note={note}
              onView={onViewNote}
              onEdit={isGuest ? undefined : onEditNote}
              onDelete={isGuest ? undefined : onDeleteNote}
            />
          ))
        )}
      </div>
    </div>
  );
};

const NoteEditor = ({
  note,
  category,
  categories,
  onSave,
  onCancel,
  onDelete,
  onOpenSettings,
  onChangeCategory
}: {
  note?: Note;
  category: Category;
  categories?: Category[];
  onSave: (note: Partial<Note>) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  onChangeCategory?: (categoryId: string) => void;
}) => {
  const { hasAnyProvider, hasMultipleProviders, availableProviders, enhance } = useAI();

  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  // Support multiple images - migrate from legacy imageUrl if needed
  const [images, setImages] = useState<string[]>(() => {
    if (note?.images && note.images.length > 0) return note.images;
    if (note?.imageUrl) return [note.imageUrl];
    return [];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showAISelector, setShowAISelector] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType | undefined>(undefined);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // AI Modal states
  const [showAIPromptModal, setShowAIPromptModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState<{ title?: string; content: string; tags?: string[] } | null>(null);
  const [showAIResultModal, setShowAIResultModal] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState<AIProviderType | undefined>(undefined);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title: title || 'Không tiêu đề',
        content,
        images: images.length > 0 ? images : undefined,
        imageUrl: images.length > 0 ? images[0] : undefined, // Keep first image as imageUrl for backward compatibility
        tags
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input to allow selecting same file again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const openAIPromptModal = (providerType?: AIProviderType) => {
    if (!hasAnyProvider) {
      alert('Chưa có API key nào được cấu hình. Vui lòng vào Cài đặt để thêm.');
      onOpenSettings?.();
      return;
    }
    setSelectedAIProvider(providerType);
    setShowAISelector(false);
    setShowAIPromptModal(true);
  };

  const handleAIEnhance = async (customPrompt?: string) => {
    if ((!content && images.length === 0 && !title) || isGenerating) return;

    setIsGenerating(true);
    setShowAIPromptModal(false);
    try {
      const response = await enhance(
        {
          title: title || undefined,
          content: content || undefined,
          imageBase64: images.length > 0 ? images[0] : undefined, // Send first image for AI analysis
          customPrompt: customPrompt || undefined
        },
        selectedAIProvider
      );

      setAiResult(response);
      setShowAIResultModal(true);
    } catch (error: any) {
      alert(error.message || "AI Error: Check API Key or try again.");
    } finally {
      setIsGenerating(false);
      setAiPrompt('');
    }
  };

  const handleInsertAIResult = (mode: 'replace' | 'append' | 'title' | 'tags') => {
    if (!aiResult) return;

    switch (mode) {
      case 'replace':
        if (aiResult.content) setContent(aiResult.content);
        if (aiResult.title) setTitle(aiResult.title);
        if (aiResult.tags) setTags(aiResult.tags);
        break;
      case 'append':
        if (aiResult.content) setContent(prev => prev ? prev + "\n\n---\n\n" + aiResult.content : aiResult.content);
        if (aiResult.tags) setTags(prev => [...new Set([...prev, ...aiResult.tags!])]);
        break;
      case 'title':
        if (aiResult.title) setTitle(aiResult.title);
        break;
      case 'tags':
        if (aiResult.tags) setTags(prev => [...new Set([...prev, ...aiResult.tags!])]);
        break;
    }
    setShowAIResultModal(false);
    setAiResult(null);
  };

  return (
    <div
      className="flex flex-col h-full bg-white relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-brand-500/10 border-2 border-dashed border-brand-500 rounded-xl flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg text-center">
            <ImageIcon className="w-10 h-10 text-brand-500 mx-auto mb-2" />
            <p className="text-brand-600 font-semibold">Thả ảnh vào đây</p>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {showGallery && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          onClick={() => setShowGallery(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm font-medium">{galleryIndex + 1} / {images.length}</span>
            <button
              onClick={() => setShowGallery(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any).startX = touch.clientX;
            }}
            onTouchEnd={(e) => {
              const touch = e.changedTouches[0];
              const startX = (e.currentTarget as any).startX;
              const diff = touch.clientX - startX;
              if (Math.abs(diff) > 50) {
                if (diff > 0 && galleryIndex > 0) {
                  setGalleryIndex(prev => prev - 1);
                } else if (diff < 0 && galleryIndex < images.length - 1) {
                  setGalleryIndex(prev => prev + 1);
                }
              }
            }}
          >
            <img
              src={images[galleryIndex]}
              alt={`Image ${galleryIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              {galleryIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex(prev => prev - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {galleryIndex < images.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex(prev => prev + 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </button>
              )}
            </>
          )}

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="p-4 flex justify-center gap-2 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex(idx); }}
                  className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    idx === galleryIndex ? 'border-white' : 'border-transparent opacity-50'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-full shadow-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Đã lưu thành công!</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          Hủy
        </button>
        <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          {note ? 'Sửa Ghi Chú' : 'Tạo Ghi Chú'}
        </span>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 text-brand-600 font-semibold hover:text-brand-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            'Lưu'
          )}
        </button>
      </div>

      {/* Category Selector */}
      {categories && categories.length > 0 && onChangeCategory && (
        <div className="px-4 py-2 bg-white border-b border-slate-100">
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg ${category.color} flex items-center justify-center text-white`}>
                <IconRenderer name={category.icon} className="w-4 h-4" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-slate-700">{category.name}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onChangeCategory(cat.id);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors ${
                      cat.id === category.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md ${cat.color} flex items-center justify-center text-white`}>
                      <IconRenderer name={cat.icon} className="w-3 h-3" />
                    </div>
                    <span className="text-sm text-slate-700">{cat.name}</span>
                    {cat.id === category.id && <Check className="w-4 h-4 text-brand-600 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <ImageIcon className="w-4 h-4 text-slate-500" />
          Thêm Ảnh
        </button>

        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <Camera className="w-4 h-4 text-slate-500" />
          Chụp Ảnh
        </button>

        {/* AI Button with selector */}
        <div className="relative">
          <div className="flex">
            <button
              onClick={() => hasMultipleProviders ? setShowAISelector(!showAISelector) : openAIPromptModal()}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border shadow-sm transition-all ${
                isGenerating
                  ? 'bg-brand-50 border-brand-200 text-brand-400'
                  : hasAnyProvider
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent hover:shadow-md'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
              } ${hasMultipleProviders ? 'rounded-r-none' : ''}`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Đang xử lý...' : hasAnyProvider ? 'AI Phân Tích' : 'Thêm API Key'}
            </button>

            {hasMultipleProviders && (
              <button
                onClick={() => setShowAISelector(!showAISelector)}
                disabled={isGenerating}
                className="px-1.5 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-r-lg border-l border-white/20"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* AI Provider Selector Dropdown */}
          {showAISelector && hasMultipleProviders && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[160px]">
              {availableProviders.map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => openAIPromptModal(provider.type)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Bot className={`w-4 h-4 ${provider.type === 'gemini' ? 'text-blue-500' : 'text-green-500'}`} />
                  <span>{provider.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {note && (
          <button
            onClick={() => onDelete && onDelete(note.id)}
            className="ml-auto text-red-500 p-1.5"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageUpload}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề (ví dụ: Công thức Logarit)"
          className="w-full text-2xl font-bold text-slate-800 placeholder-slate-300 border-none outline-none bg-transparent mb-4"
        />

        {/* Masonry Image Gallery */}
        {images.length > 0 && (
          <div className="mb-6">
            <div className={`grid gap-2 ${
              images.length === 1 ? 'grid-cols-1' :
              images.length === 2 ? 'grid-cols-2' :
              images.length === 3 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {images.map((img, index) => (
                <div
                  key={index}
                  className={`relative rounded-xl overflow-hidden group border border-slate-100 shadow-sm bg-slate-50 cursor-pointer ${
                    images.length === 3 && index === 0 ? 'row-span-2' : ''
                  }`}
                  onClick={() => {
                    setGalleryIndex(index);
                    setShowGallery(true);
                  }}
                >
                  <img
                    src={img}
                    alt={`Image ${index + 1}`}
                    className={`w-full object-cover ${
                      images.length === 1 ? 'max-h-64' :
                      images.length === 3 && index === 0 ? 'h-full' :
                      'h-32'
                    }`}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {images.length > 1 && index === 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {images.length} ảnh - Click để xem
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Add more images button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 w-full py-2 border border-dashed border-slate-200 rounded-lg text-sm text-slate-400 hover:border-brand-300 hover:text-brand-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm ảnh
            </button>
          </div>
        )}

        {images.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="mb-6 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Kéo thả ảnh vào đây hoặc click để chọn</p>
            <p className="text-xs text-slate-300 mt-1">Có thể chọn nhiều ảnh cùng lúc</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag, idx) => (
            <span key={idx} className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-md">#{tag}</span>
          ))}
        </div>

        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Viết nội dung ghi chú ở đây... Hoặc tải ảnh lên và để AI giúp bạn viết."
        />
      </div>

      {/* AI Prompt Modal */}
      {showAIPromptModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAIPromptModal(false)}>
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI Phân Tích
                </h3>
                <button onClick={() => setShowAIPromptModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Context Preview */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Dữ liệu gửi đi:</p>
                <div className="space-y-1 text-sm">
                  {title && (
                    <p className="text-slate-600"><span className="font-medium">Tiêu đề:</span> {title.substring(0, 50)}{title.length > 50 ? '...' : ''}</p>
                  )}
                  {content && (
                    <p className="text-slate-600"><span className="font-medium">Nội dung:</span> {content.replace(/<[^>]*>/g, '').substring(0, 80)}{content.length > 80 ? '...' : ''}</p>
                  )}
                  {images.length > 0 && (
                    <p className="text-slate-600 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      <span className="font-medium">Có {images.length} ảnh đính kèm</span>
                    </p>
                  )}
                  {!title && !content && images.length === 0 && (
                    <p className="text-slate-400 italic">Chưa có dữ liệu nào</p>
                  )}
                </div>
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Yêu cầu của bạn (tùy chọn)
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ví dụ: Giải thích công thức này, Tóm tắt nội dung, Dịch sang tiếng Anh..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Để trống để AI tự động phân tích và tóm tắt
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAIPromptModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleAIEnhance(aiPrompt || undefined)}
                  disabled={!title && !content && images.length === 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Phân tích
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Modal */}
      {showAIResultModal && aiResult && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAIResultModal(false)}>
          <div
            className="bg-white w-full max-w-md max-h-[80vh] rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Kết quả AI
                </h3>
                <button onClick={() => { setShowAIResultModal(false); setAiResult(null); }} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Title Result */}
              {aiResult.title && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-blue-600 uppercase">Tiêu đề gợi ý</p>
                    <button
                      onClick={() => handleInsertAIResult('title')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Dùng tiêu đề này
                    </button>
                  </div>
                  <p className="text-slate-800 font-medium">{aiResult.title}</p>
                </div>
              )}

              {/* Content Result */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Nội dung</p>
                <div className="text-sm text-slate-700 prose prose-sm max-w-none whitespace-pre-wrap">
                  {aiResult.content}
                </div>
              </div>

              {/* Tags Result */}
              {aiResult.tags && aiResult.tags.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-purple-600 uppercase">Tags gợi ý</p>
                    <button
                      onClick={() => handleInsertAIResult('tags')}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Thêm tags
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiResult.tags.map((tag, idx) => (
                      <span key={idx} className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-md">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleInsertAIResult('append')}
                  className="py-2.5 border border-purple-200 text-purple-600 rounded-xl font-medium hover:bg-purple-50 text-sm"
                >
                  Thêm vào cuối
                </button>
                <button
                  onClick={() => handleInsertAIResult('replace')}
                  className="py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-md text-sm"
                >
                  Thay thế toàn bộ
                </button>
              </div>
              <button
                onClick={() => { setShowAIResultModal(false); setAiResult(null); }}
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-sm"
              >
                Đóng (không lưu)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
              <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="text-slate-600 font-medium">AI đang phân tích...</p>
            <p className="text-xs text-slate-400">Vui lòng đợi trong giây lát</p>
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryEditor = ({
  category,
  isAdmin,
  onSave,
  onCancel,
  onDelete,
  onTogglePublish
}: {
  category?: Category;
  isAdmin?: boolean;
  onSave: (data: Partial<Category>) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onTogglePublish?: (category: Category, makePublic: boolean) => Promise<void>;
}) => {
  const [name, setName] = useState(category?.name || '');
  const [selectedColor, setSelectedColor] = useState(category?.color || 'bg-slate-500');
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || 'BookOpen');
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  const handleTogglePublish = async () => {
    if (!category || !onTogglePublish || isTogglingPublish) return;

    const action = category.isPublic ? 'chuyển về riêng tư' : 'công khai';
    if (!confirm(`Bạn có chắc muốn ${action} danh mục này?`)) return;

    setIsTogglingPublish(true);
    try {
      await onTogglePublish(category, !category.isPublic);
    } catch (error) {
      console.error('Toggle publish error:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const colors = [
    'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
    'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];

  const icons = [
    'BookOpen', 'Calculator', 'FlaskConical', 'Languages', 'Palette',
    'Briefcase', 'Music', 'Code', 'Globe', 'Lightbulb'
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-800">Hủy</button>
        <span className="text-sm font-semibold text-slate-800">{category ? 'Sửa Danh Mục' : 'Danh Mục Mới'}</span>
        <button 
          onClick={() => {
            if (!name.trim()) return alert('Vui lòng nhập tên danh mục');
            onSave({ name, color: selectedColor, icon: selectedIcon });
          }}
          className="text-brand-600 font-semibold"
        >
          Lưu
        </button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
          <div className={`w-16 h-16 rounded-2xl ${selectedColor} flex items-center justify-center text-white shadow-md mb-3 transition-colors duration-300`}>
            <IconRenderer name={selectedIcon} className="w-8 h-8" />
          </div>
          <span className="font-bold text-lg text-slate-700">{name || 'Tên danh mục'}</span>
          {category?.isPublic && (
            <span className="mt-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Public
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tên Danh Mục</label>
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Ví dụ: Hóa học, Lịch sử..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Màu sắc</label>
          <div className="grid grid-cols-8 gap-3">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-8 h-8 rounded-full ${c} transition-transform hover:scale-110 flex items-center justify-center ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
              >
                {selectedColor === c && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Biểu tượng</label>
          <div className="grid grid-cols-5 gap-3">
            {icons.map((icon) => (
              <button
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                className={`p-3 rounded-xl border flex items-center justify-center transition-all ${selectedIcon === icon ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                <IconRenderer name={icon} className="w-6 h-6" />
              </button>
            ))}
          </div>
        </div>

        {/* Admin publish toggle */}
        {category && isAdmin && onTogglePublish && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hiển thị</label>
            <button
              onClick={handleTogglePublish}
              disabled={isTogglingPublish}
              className={`w-full py-3 rounded-xl border font-medium transition-all flex items-center justify-center gap-2 ${
                category.isPublic
                  ? 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
                  : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {isTogglingPublish ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : category.isPublic ? (
                <>
                  <Globe className="w-4 h-4" />
                  Đang công khai - Click để chuyển riêng tư
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Đang riêng tư - Click để công khai
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400">
              {category.isPublic ? 'Danh mục này hiển thị cho tất cả người dùng' : 'Chỉ bạn có thể thấy danh mục này'}
            </p>
          </div>
        )}

        {category && onDelete && (
          <div className="pt-6 border-t border-slate-100">
             <button
               onClick={() => onDelete(category.id)}
               className="w-full py-3 rounded-xl border border-red-100 text-red-500 bg-red-50 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
             >
               <Trash2 className="w-4 h-4" /> Xóa Danh Mục
             </button>
             <p className="text-center text-xs text-slate-400 mt-2">Xóa danh mục sẽ không xóa các ghi chú bên trong.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Authenticated App Logic ---

const AuthenticatedApp = () => {
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch initial data from Firestore
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setIsLoadingData(true);
        try {
          const [cats, ns] = await Promise.all([
            dbService.fetchCategories(user.uid),
            dbService.fetchNotes(user.uid)
          ]);
          setCategories(cats);
          setNotes(ns);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingData(false);
        }
      };
      loadData();
    }
  }, [user]);

  // Derived state
  const filteredNotes = notes
    .filter(n => activeCategoryId ? n.categoryId === activeCategoryId : true)
    .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const notesCountByCategory = notes.reduce((acc, note) => {
    acc[note.categoryId] = (acc[note.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Note Handlers
  const handleCreateNote = () => {
    setActiveNote(undefined);
    // If no active category, default to first category
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategoryId(categories[0].id);
    }
    setView('NOTE_EDITOR');
  };

  const handleSelectCategory = (id: string) => {
    setActiveCategoryId(id);
    setView('CATEGORY_DETAIL');
  };

  const handleSaveNote = async (data: Partial<Note>): Promise<void> => {
    if (!user) return;

    const currentCategory = categories.find(c => c.id === activeCategoryId);
    const categoryIsPublic = currentCategory?.isPublic || false;

    const noteData = {
      ...data,
      categoryId: activeCategoryId || categories[0]?.id || '',
      id: activeNote?.id,
      isPublic: activeNote?.isPublic // Preserve existing isPublic status for updates
    };

    const result = await dbService.saveNote(user.uid, noteData as any, isAdmin, categoryIsPublic);

    // Optimistic Update or Re-fetch
    if (activeNote) {
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, ...data, updatedAt: Date.now() } as Note : n));
    } else {
      const newNote = {
        id: result.id,
        ...noteData,
        isPublic: result.isPublic,
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as Note;
      setNotes(prev => [newNote, ...prev]);
    }

    // Delay navigation to show success message
    setTimeout(() => {
      setView(activeCategoryId ? 'CATEGORY_DETAIL' : 'DASHBOARD');
    }, 1500);
  };

  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    const noteToDelete = notes.find(n => n.id === id);
    if (confirm('Bạn có chắc muốn xóa ghi chú này?')) {
      try {
        await dbService.deleteNote(user.uid, id, noteToDelete?.isPublic, isAdmin);
        setNotes(prev => prev.filter(n => n.id !== id));
        setView(activeCategoryId ? 'CATEGORY_DETAIL' : 'DASHBOARD');
      } catch(e) {
        console.error(e);
        alert('Không thể xóa ghi chú này');
      }
    }
  };

  // Delete note directly (confirmation handled in component)
  const handleDeleteNoteDirectly = async (id: string) => {
    if (!user) return;
    const noteToDelete = notes.find(n => n.id === id);
    try {
      await dbService.deleteNote(user.uid, id, noteToDelete?.isPublic, isAdmin);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch(e) {
      console.error(e);
    }
  };

  // Category Handlers
  const handleSaveCategory = async (data: Partial<Category>) => {
    if (!user) return;

    try {
      if (activeCategoryId && view === 'CATEGORY_EDITOR') {
         const catToUpdate = categories.find(c => c.id === activeCategoryId);
         if(catToUpdate) {
             console.log('Updating category:', { catToUpdate, data, isAdmin });
             await dbService.updateCategory(user.uid, { ...catToUpdate, ...data }, isAdmin);
             setCategories(prev => prev.map(c => c.id === activeCategoryId ? { ...c, ...data } as Category : c));
             setView('CATEGORY_DETAIL');
         }
      } else {
        const newId = await dbService.addCategory(user.uid, data as any);
        const newCat = { id: newId, ...data } as Category;
        setCategories(prev => [...prev, newCat]);
        setView('DASHBOARD');
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save category. isAdmin=" + isAdmin);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;
    if (categories.length <= 0) return;
    
    if (confirm(`Bạn có chắc muốn xóa danh mục này? Các ghi chú sẽ được chuyển về danh mục khác.`)) {
      const fallbackCat = categories.find(c => c.id !== id);
      if (fallbackCat) {
         await dbService.migrateNotesToCategory(user.uid, id, fallbackCat.id);
         // Update local state notes
         setNotes(prev => prev.map(n => n.categoryId === id ? {...n, categoryId: fallbackCat.id} : n));
      }
      await dbService.deleteCategory(user.uid, id);
      setCategories(prev => prev.filter(c => c.id !== id));
      setActiveCategoryId(null);
      setView('DASHBOARD');
    }
  }

  if (isLoadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'DASHBOARD':
        return (
          <DashboardView
            categories={categories}
            notes={notes}
            onSelectCategory={handleSelectCategory}
            totalNotes={notesCountByCategory}
            onAddCategory={() => {
              setActiveCategoryId(null);
              setView('CATEGORY_EDITOR');
            }}
            onViewNote={(note, categoryId) => {
              setActiveCategoryId(categoryId);
              setActiveNote(note);
              setView('NOTE_VIEWER');
            }}
          />
        );
      case 'CATEGORY_DETAIL':
        const cat = categories.find(c => c.id === activeCategoryId);
        if (!cat) return null;
        return (
          <CategoryDetail
            category={cat}
            notes={filteredNotes}
            onBack={() => setView('DASHBOARD')}
            onViewNote={(note) => {
              setActiveNote(note);
              setView('NOTE_VIEWER');
            }}
            onEditNote={(note) => {
              setActiveNote(note);
              setView('NOTE_EDITOR');
            }}
            onDeleteNote={handleDeleteNoteDirectly}
            onSearch={setSearchQuery}
            onEditCategory={(c) => {
              setActiveCategoryId(c.id);
              setView('CATEGORY_EDITOR');
            }}
          />
        );
      case 'NOTE_VIEWER':
        const viewCategory = categories.find(c => c.id === activeCategoryId) || categories[0];
        if (!activeNote) return null;
        return (
          <NoteViewer
            note={activeNote}
            notes={filteredNotes}
            category={viewCategory}
            isAdmin={isAdmin}
            onBack={() => setView('CATEGORY_DETAIL')}
            onEdit={() => setView('NOTE_EDITOR')}
            onDelete={(id) => {
              handleDeleteNoteDirectly(id);
              setView('CATEGORY_DETAIL');
            }}
            onSaveHighlights={async (content) => {
              if (!user || !activeNote) return;
              // Handle both public and private notes
              const categoryIsPublic = viewCategory?.isPublic || false;
              await dbService.saveNote(user.uid, {
                ...activeNote,
                content
              }, isAdmin, categoryIsPublic);
              setNotes(prev => prev.map(n =>
                n.id === activeNote.id ? { ...n, content, updatedAt: Date.now() } : n
              ));
              setActiveNote(prev => prev ? { ...prev, content } : prev);
            }}
            onNavigate={(note) => {
              setActiveNote(note);
            }}
            onTogglePublish={isAdmin ? async (note, makePublic) => {
              if (!user) return;
              const result = await dbService.toggleNotePublish(user.uid, note, makePublic);

              // Update note in state with new id and isPublic status
              const updatedNote = { ...note, id: result.newId, isPublic: result.isPublic };
              setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
              setActiveNote(updatedNote);
            } : undefined}
          />
        );
      case 'NOTE_EDITOR':
        const currentCategory = categories.find(c => c.id === activeCategoryId) || categories[0];
        return (
          <NoteEditor
            note={activeNote}
            category={currentCategory}
            categories={categories}
            onSave={handleSaveNote}
            onCancel={() => setView(activeNote ? 'NOTE_VIEWER' : 'CATEGORY_DETAIL')}
            onDelete={handleDeleteNote}
            onOpenSettings={() => setView('SETTINGS')}
            onChangeCategory={(catId) => setActiveCategoryId(catId)}
          />
        );
      case 'SETTINGS':
        return (
          <SettingsView
            onBack={() => setView('DASHBOARD')}
            onSettingsSaved={() => {
              // AI settings will be reloaded by AIContext
            }}
          />
        );
      case 'CATEGORY_EDITOR':
        const editCat = activeCategoryId ? categories.find(c => c.id === activeCategoryId) : undefined;
        return (
          <CategoryEditor
            category={editCat}
            isAdmin={isAdmin}
            onSave={handleSaveCategory}
            onCancel={() => setView(activeCategoryId ? 'CATEGORY_DETAIL' : 'DASHBOARD')}
            onDelete={handleDeleteCategory}
            onTogglePublish={isAdmin ? async (cat, makePublic) => {
              if (!user) return;
              const result = await dbService.toggleCategoryPublish(user.uid, cat, makePublic);

              // Update category in state with new id and isPublic status
              const updatedCat = { ...cat, id: result.newId, isPublic: result.isPublic };
              setCategories(prev => prev.map(c => c.id === cat.id ? updatedCat : c));

              // Update notes with new IDs and categoryId
              setNotes(prev => prev.map(n => {
                if (n.categoryId === cat.id) {
                  const newNoteId = result.migratedNoteIds.get(n.id);
                  if (newNoteId) {
                    return { ...n, id: newNoteId, categoryId: result.newId, isPublic: result.isPublic };
                  }
                  // Note wasn't migrated (shouldn't happen), update categoryId anyway
                  return { ...n, categoryId: result.newId, isPublic: result.isPublic };
                }
                return n;
              }));

              setActiveCategoryId(result.newId);
            } : undefined}
          />
        );
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative shadow-2xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        {renderView()}
      </div>

      {(view === 'DASHBOARD' || view === 'CATEGORY_DETAIL') && categories.length > 0 && (
        <div className={`absolute right-6 z-50 ${view === 'DASHBOARD' ? 'bottom-24' : 'bottom-6'}`}>
          <button
            onClick={handleCreateNote}
            className="w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus className="w-8 h-8" />
          </button>
        </div>
      )}
      
      {view === 'DASHBOARD' && (
        <nav className="bg-white border-t border-slate-100 py-3 px-6 flex justify-between items-center text-slate-400">
           <button className="flex flex-col items-center gap-1 text-brand-600">
             <LayoutGrid className="w-6 h-6" />
             <span className="text-[10px] font-medium">Trang chủ</span>
           </button>
           <button className="flex flex-col items-center gap-1 hover:text-slate-600">
             <Search className="w-6 h-6" />
             <span className="text-[10px] font-medium">Tìm kiếm</span>
           </button>
           <button
             onClick={() => setView('SETTINGS')}
             className="flex flex-col items-center gap-1 hover:text-slate-600"
           >
             <Settings className="w-6 h-6" />
             <span className="text-[10px] font-medium">Cài đặt</span>
           </button>
        </nav>
      )}

    </div>
  );
}

// Guest App - Read-only view of public content
const GuestApp = ({ onLogin }: { onLogin: () => void }) => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch only public data
  useEffect(() => {
    const loadPublicData = async () => {
      setIsLoadingData(true);
      try {
        const [cats, ns] = await Promise.all([
          dbService.fetchPublicCategories(),
          dbService.fetchPublicNotes()
        ]);
        setCategories(cats);
        setNotes(ns);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadPublicData();
  }, []);

  // Derived state
  const filteredNotes = notes
    .filter(n => activeCategoryId ? n.categoryId === activeCategoryId : true)
    .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const notesCountByCategory = notes.reduce((acc, note) => {
    acc[note.categoryId] = (acc[note.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSelectCategory = (id: string) => {
    setActiveCategoryId(id);
    setView('CATEGORY_DETAIL');
  };

  if (isLoadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'DASHBOARD':
        return (
          <DashboardView
            categories={categories}
            notes={notes}
            onSelectCategory={handleSelectCategory}
            totalNotes={notesCountByCategory}
            onAddCategory={() => onLogin()} // Redirect to login
            onViewNote={(note, categoryId) => {
              setActiveCategoryId(categoryId);
              setActiveNote(note);
              setView('NOTE_VIEWER');
            }}
            isGuest={true}
          />
        );
      case 'CATEGORY_DETAIL':
        const cat = categories.find(c => c.id === activeCategoryId);
        if (!cat) return null;
        return (
          <CategoryDetail
            category={cat}
            notes={filteredNotes}
            onBack={() => setView('DASHBOARD')}
            onViewNote={(note) => {
              setActiveNote(note);
              setView('NOTE_VIEWER');
            }}
            onEditNote={() => onLogin()} // Redirect to login
            onDeleteNote={() => onLogin()} // Redirect to login
            onSearch={setSearchQuery}
            onEditCategory={() => onLogin()} // Redirect to login
            isGuest={true}
          />
        );
      case 'NOTE_VIEWER':
        const viewCategory = categories.find(c => c.id === activeCategoryId) || categories[0];
        if (!activeNote) return null;
        return (
          <NoteViewer
            note={activeNote}
            notes={filteredNotes}
            category={viewCategory}
            isAdmin={false}
            onBack={() => setView('CATEGORY_DETAIL')}
            onEdit={() => onLogin()} // Redirect to login
            onDelete={() => onLogin()} // Redirect to login
            onNavigate={(note) => setActiveNote(note)}
            isGuest={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative shadow-2xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        {renderView()}
      </div>

      {/* Login prompt for guests */}
      <nav className="bg-white border-t border-slate-100 py-3 px-6 flex justify-between items-center text-slate-400">
        <button className="flex flex-col items-center gap-1 text-brand-600">
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[10px] font-medium">Trang chủ</span>
        </button>
        <button
          onClick={onLogin}
          className="flex flex-col items-center gap-1 bg-brand-600 text-white px-4 py-2 rounded-full hover:bg-brand-700 transition-colors"
        >
          <span className="text-sm font-medium">Đăng nhập</span>
        </button>
      </nav>
    </div>
  );
};

const Root = () => {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }

      try {
        const profile = await dbService.fetchUserProfile(user.uid);
        // If no profile exists, show setup screen
        setNeedsSetup(!profile);
      } catch (error) {
        console.error('Error checking profile:', error);
        // On error, assume needs setup
        setNeedsSetup(true);
      } finally {
        setCheckingProfile(false);
      }
    };

    if (user) {
      checkUserProfile();
      setShowLogin(false); // Reset when user logs in
    } else {
      setCheckingProfile(false);
    }
  }, [user]);

  if (loading || checkingProfile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  // User wants to login
  if (showLogin && !user) {
    return <AuthView />;
  }

  // Not logged in - show guest view with public content
  if (!user) {
    return <GuestApp onLogin={() => setShowLogin(true)} />;
  }

  if (needsSetup) {
    return (
      <AdminSetupView
        onComplete={() => setNeedsSetup(false)}
        onSkip={() => setNeedsSetup(false)}
      />
    );
  }

  return (
    <AIContextProvider>
      <AuthenticatedApp />
    </AIContextProvider>
  );
}

const App = () => {
  return (
    <AuthProvider>
      <Root />
      <PWAInstallPrompt />
    </AuthProvider>
  );
};

export default App;