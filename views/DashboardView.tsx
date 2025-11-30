import React, { useState, useMemo } from 'react';
import { Category, Note } from '../types';
import { IconRenderer } from '../components/IconRenderer';
import { LogOut, Globe, Search, X, FileText } from 'lucide-react';
import { auth } from '../config/firebase';

export const DashboardView = ({
  categories,
  notes,
  onSelectCategory,
  totalNotes,
  onAddCategory,
  onViewNote,
  isGuest = false
}: {
  categories: Category[];
  notes: Note[];
  onSelectCategory: (id: string) => void;
  totalNotes: Record<string, number>;
  onAddCategory: () => void;
  onViewNote: (note: Note, categoryId: string) => void;
  isGuest?: boolean;
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase().trim();

    // Search categories by name
    const matchedCategories = categories.filter(cat =>
      cat.name.toLowerCase().includes(query)
    );

    // Search notes by title, content, and category name
    const matchedNotes = notes.filter(note => {
      const category = categories.find(c => c.id === note.categoryId);
      const categoryName = category?.name.toLowerCase() || '';

      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        categoryName.includes(query) ||
        note.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    });

    return { categories: matchedCategories, notes: matchedNotes };
  }, [searchQuery, categories, notes]);

  const getCategoryForNote = (note: Note) => {
    return categories.find(c => c.id === note.categoryId);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isGuest ? 'Chào mừng!' : 'Xin chào,'}
          </h1>
          <p className="text-slate-500">
            {isGuest ? 'Khám phá kiến thức được chia sẻ' : 'Bạn muốn ôn lại gì hôm nay?'}
          </p>
        </div>
        {!isGuest && (
          <button
            onClick={() => auth.signOut()}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm ghi chú, danh mục..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">
            Kết quả tìm kiếm "{searchQuery}"
          </h3>

          {searchResults.categories.length === 0 && searchResults.notes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Không tìm thấy kết quả nào</p>
            </div>
          ) : (
            <>
              {/* Matched Categories */}
              {searchResults.categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Danh mục ({searchResults.categories.length})
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {searchResults.categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => onSelectCategory(cat.id)}
                        className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-transform flex items-center gap-3 hover:shadow-md"
                      >
                        <div className={`p-2 rounded-lg text-white ${cat.color}`}>
                          <IconRenderer name={cat.icon} className="w-4 h-4" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <span className="block font-medium text-slate-800 truncate">{cat.name}</span>
                          <span className="text-xs text-slate-400">{totalNotes[cat.id] || 0} ghi chú</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Notes */}
              {searchResults.notes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Ghi chú ({searchResults.notes.length})
                  </p>
                  <div className="space-y-2">
                    {searchResults.notes.map((note) => {
                      const category = getCategoryForNote(note);
                      return (
                        <button
                          key={note.id}
                          onClick={() => onViewNote(note, note.categoryId)}
                          className="w-full bg-white p-3 rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform flex items-start gap-3 hover:shadow-md text-left"
                        >
                          <div className={`p-2 rounded-lg text-white ${category?.color || 'bg-slate-500'} flex-shrink-0`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-medium text-slate-800 truncate">{note.title}</span>
                            <span className="text-xs text-slate-400 line-clamp-1">
                              {note.content.replace(/<[^>]*>/g, '').substring(0, 60)}...
                            </span>
                            <span className="text-xs text-brand-500 mt-1 block">{category?.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Normal Dashboard Content - Show when not searching */}
      {!searchResults && (
        <>

      <div className="bg-gradient-to-r from-brand-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
        <h2 className="text-xl font-bold mb-2">Học tập thông minh</h2>
        <p className="opacity-90 text-sm mb-4">Lưu lại kiến thức và để giúp bạn ghi nhớ lâu hơn.</p>
        <div className="flex gap-4 text-xs font-medium opacity-80">
          <span>✨ Tự động tóm tắt</span>
          <span>☁️ Đồng bộ đám mây</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700 text-lg">Danh mục</h3>
          {!isGuest && (
            <button
              onClick={onAddCategory}
              className="text-xs font-medium text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
            >
              + Tạo mới
            </button>
          )}
        </div>
        {categories.length === 0 ? (
           <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
             <p>{isGuest ? 'Chưa có nội dung công khai nào.' : 'Chưa có danh mục nào.'}</p>
             {!isGuest && (
               <button onClick={onAddCategory} className="text-brand-600 text-sm font-medium mt-1">Tạo ngay</button>
             )}
           </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-transform flex flex-col gap-3 items-start hover:shadow-md relative"
              >
                {cat.isPublic && (
                  <span className="absolute top-2 right-2 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" />
                  </span>
                )}
                <div className={`p-2.5 rounded-lg text-white ${cat.color} shadow-sm`}>
                  <IconRenderer name={cat.icon} className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block font-semibold text-slate-800">{cat.name}</span>
                  <span className="text-xs text-slate-400">{totalNotes[cat.id] || 0} ghi chú</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};