import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, Key, Eye, EyeOff, Loader2, CheckCircle,
  Sparkles, Bot, AlertCircle, Trash2, LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserAISettings, AIProviderType } from '../services/ai/types';
import * as dbService from '../services/dbService';
import { auth } from '../config/firebase';
import { useAI } from '../contexts/AIContext';

interface SettingsViewProps {
  onBack: () => void;
  onSettingsSaved?: (settings: UserAISettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack, onSettingsSaved }) => {
  const { user } = useAuth();
  const { reloadSettings } = useAI();

  const [geminiKey, setGeminiKey] = useState('');
  const [chatgptKey, setChatgptKey] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<AIProviderType | ''>('');

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showChatgptKey, setShowChatgptKey] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const settings = await dbService.fetchUserAISettings(user.uid);
        if (settings) {
          setGeminiKey(settings.geminiApiKey || '');
          setChatgptKey(settings.chatgptApiKey || '');
          setPreferredProvider(settings.preferredProvider || '');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Không thể tải cài đặt');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      const settings: UserAISettings = {
        geminiApiKey: geminiKey.trim() || undefined,
        chatgptApiKey: chatgptKey.trim() || undefined,
        preferredProvider: preferredProvider || undefined
      };

      await dbService.saveUserAISettings(user.uid, settings);

      // Reload AI settings in context
      await reloadSettings();

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);

      onSettingsSaved?.(settings);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Không thể lưu cài đặt. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = async (provider: 'gemini' | 'chatgpt') => {
    if (!confirm(`Bạn có chắc muốn xóa API key của ${provider === 'gemini' ? 'Gemini' : 'ChatGPT'}?`)) {
      return;
    }

    if (provider === 'gemini') {
      setGeminiKey('');
    } else {
      setChatgptKey('');
    }
  };

  const hasGemini = geminiKey.trim().length > 0;
  const hasChatgpt = chatgptKey.trim().length > 0;
  const hasBothProviders = hasGemini && hasChatgpt;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Cài đặt</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Success Toast */}
      {showSaved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-full shadow-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Đã lưu thành công!</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* AI Section */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">API Keys cho AI</h2>
              <p className="text-xs text-slate-500">Thêm key để sử dụng tính năng AI phân tích</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Gemini API Key */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Bot className="w-4 h-4 text-blue-500" />
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full p-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {hasGemini && (
                  <button
                    type="button"
                    onClick={() => handleClearKey('gemini')}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Lấy key tại{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {/* ChatGPT API Key */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Bot className="w-4 h-4 text-green-500" />
              OpenAI ChatGPT API Key
            </label>
            <div className="relative">
              <input
                type={showChatgptKey ? 'text' : 'password'}
                value={chatgptKey}
                onChange={(e) => setChatgptKey(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowChatgptKey(!showChatgptKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  {showChatgptKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {hasChatgpt && (
                  <button
                    type="button"
                    onClick={() => handleClearKey('chatgpt')}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Lấy key tại{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                OpenAI Platform
              </a>
            </p>
          </div>

          {/* Preferred Provider */}
          {hasBothProviders && (
            <div className="mb-4 pt-4 border-t border-slate-100">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                AI mặc định
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredProvider('gemini')}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    preferredProvider === 'gemini'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span className="text-sm font-medium">Gemini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredProvider('chatgpt')}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    preferredProvider === 'chatgpt'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span className="text-sm font-medium">ChatGPT</span>
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Khi có cả 2 AI, bạn vẫn có thể chọn AI khác khi phân tích
              </p>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Lưu cài đặt
              </>
            )}
          </button>
        </section>

        {/* Security Notice */}
        <section className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 mb-1">Bảo mật API Key</h3>
              <p className="text-xs text-amber-700">
                API keys được mã hóa và lưu trữ riêng tư trong tài khoản của bạn.
                Chỉ bạn mới có thể truy cập. Không chia sẻ key với người khác.
              </p>
            </div>
          </div>
        </section>

        {/* Account Section */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-4">Tài khoản</h2>

          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <span className="text-sm text-slate-600">Email</span>
            <span className="text-sm font-medium text-slate-800">{user?.email}</span>
          </div>

          <button
            onClick={() => auth.signOut()}
            className="w-full mt-4 py-3 border border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </section>
      </div>
    </div>
  );
};
