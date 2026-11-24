import React from 'react';
import { CheckCircle2, AlertCircle, Info, Copy, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  actionText?: string;
  onAction?: () => void;
  copyText?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const handleCopy = () => {
          if (toast.copyText) {
            navigator.clipboard.writeText(toast.copyText);
            setCopiedId(toast.id);
            setTimeout(() => setCopiedId(null), 2500);
          }
        };

        const isCopied = copiedId === toast.id;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-[#141824]/95 backdrop-blur-md border border-[#2a3449] rounded-xl shadow-2xl text-slate-100 animate-in slide-in-from-bottom duration-200"
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400" />}
              {toast.type === 'warning' && <AlertCircle size={16} className="text-amber-400" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-rose-400" />}
              {toast.type === 'info' && <Info size={16} className="text-cyan-400" />}
            </div>

            <div className="flex-1 text-xs leading-relaxed space-y-1.5">
              <p className="text-slate-200">{toast.message}</p>

              {(toast.copyText || toast.onAction) && (
                <div className="flex items-center gap-2 pt-0.5">
                  {toast.copyText && (
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[11px] transition shadow"
                    >
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{isCopied ? t('common.copied') : toast.actionText || t('toast.copyInstruction')}</span>
                    </button>
                  )}
                  {toast.onAction && !toast.copyText && (
                    <button
                      onClick={toast.onAction}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-[11px] transition shadow"
                    >
                      <span>{toast.actionText || t('common.confirm')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
