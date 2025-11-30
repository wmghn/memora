import React, { useState } from 'react';
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { setupInitialAdmin, createUserProfileViaFunction } from '../services/adminService';

interface AdminSetupViewProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const AdminSetupView: React.FC<AdminSetupViewProps> = ({ onComplete, onSkip }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'not-admin'>('idle');
  const [message, setMessage] = useState('');

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

  const isEligible = user?.email && adminEmails.includes(user.email.toLowerCase());

  const handleSetupAdmin = async () => {
    if (!user) return;

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // First, create user profile
      await createUserProfileViaFunction();

      // Then setup as admin
      const result = await setupInitialAdmin();

      if (result.success) {
        setStatus('success');
        setMessage('Bạn đã trở thành Admin!');
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Setup admin error:', error);

      if (error.code === 'functions/already-exists') {
        setStatus('error');
        setMessage('Đã có Admin trong hệ thống.');
      } else if (error.code === 'functions/permission-denied') {
        setStatus('not-admin');
        setMessage('Email của bạn không có quyền làm Admin.');
      } else {
        setStatus('error');
        setMessage(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await createUserProfileViaFunction();
      setStatus('success');
      setMessage('Tạo profile thành công!');
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error: any) {
      console.error('Create profile error:', error);
      setStatus('error');
      setMessage(error.message || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Thiết lập tài khoản</h1>
          <p className="text-indigo-100 text-sm">
            {user?.email}
          </p>
        </div>

        <div className="p-8 space-y-4">
          {status === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{message}</span>
            </div>
          )}

          {(status === 'error' || status === 'not-admin') && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{message}</span>
            </div>
          )}

          {isEligible ? (
            <>
              <p className="text-sm text-slate-600 text-center">
                Email của bạn có quyền trở thành <strong>Admin</strong>.
                Bấm nút bên dưới để kích hoạt.
              </p>

              <button
                onClick={handleSetupAdmin}
                disabled={loading || status === 'success'}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'success' ? 'Đã kích hoạt!' : 'Kích hoạt Admin'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 text-center">
                Chào mừng bạn đến với <strong>Memora</strong>!
                Bấm nút bên dưới để tạo profile và bắt đầu sử dụng.
              </p>

              <button
                onClick={handleCreateProfile}
                disabled={loading || status === 'success'}
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'success' ? 'Hoàn tất!' : 'Bắt đầu sử dụng'}
              </button>
            </>
          )}

          <button
            onClick={onSkip}
            className="w-full text-slate-500 text-sm hover:text-slate-700 py-2"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
};
