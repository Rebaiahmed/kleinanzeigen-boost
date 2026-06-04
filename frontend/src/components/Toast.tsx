import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { ToastType } from '../hooks/useAdsActions';

interface ToastProps {
  message: string | null;
  type: ToastType;
}

export function Toast({ message, type }: ToastProps) {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-sm shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
        isError ? 'bg-[#ef4444]' : 'bg-[#333]'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 text-white shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-[#A8C300] shrink-0" />
      )}
      <span className="text-[13px] font-medium text-white">{message}</span>
    </div>
  );
}
