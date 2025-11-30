import React, { useState, useEffect } from 'react';
import { Download, X, Wifi, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user has dismissed the prompt before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    // Online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineToast(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineToast(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowOfflineToast(false), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <>
      {/* Offline Toast */}
      {showOfflineToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-full shadow-lg">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Đang offline - Dữ liệu được lưu tạm</span>
          </div>
        </div>
      )}

      {/* Online indicator (shows briefly when coming back online) */}
      {isOnline && !showOfflineToast && (
        <div className="fixed top-4 right-4 z-[100]">
          <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium opacity-0 hover:opacity-100 transition-opacity">
            <Wifi className="w-3.5 h-3.5" />
            <span>Online</span>
          </div>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 max-w-md mx-auto">
            <div className="flex items-start gap-3">
              {/* App Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 512 512" className="w-8 h-8">
                  <g fill="white">
                    <path d="M128 120 C128 100, 145 85, 165 85 L240 85 L240 390 L165 390 C145 390, 128 375, 128 355 Z" opacity="0.9"/>
                    <path d="M272 85 L347 85 C367 85, 384 100, 384 120 L384 355 C384 375, 367 390, 347 390 L272 390 Z" opacity="0.9"/>
                  </g>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800">Cài đặt Memora</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Thêm vào màn hình chính để truy cập nhanh và dùng offline
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
              >
                Để sau
              </button>
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Cài đặt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// iOS Install Instructions (since iOS doesn't support beforeinstallprompt)
export const IOSInstallInstructions: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Thêm vào màn hình chính</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-slate-800">Nhấn nút Chia sẻ</p>
              <p className="text-sm text-slate-500">Biểu tượng hình vuông có mũi tên lên ở thanh công cụ</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-slate-800">Cuộn xuống và chọn "Thêm vào MH chính"</p>
              <p className="text-sm text-slate-500">Hoặc "Add to Home Screen"</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-slate-800">Nhấn "Thêm" ở góc trên bên phải</p>
              <p className="text-sm text-slate-500">Memora sẽ xuất hiện trên màn hình chính</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
