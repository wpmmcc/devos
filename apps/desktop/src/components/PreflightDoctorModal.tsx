import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RotateCw, Stethoscope } from 'lucide-react';
import { DiagnosticItem } from '../types';
import { Bridge } from '../services/tauriBridge';

interface PreflightDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreflightDoctorModal: React.FC<PreflightDoctorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDoctor = async () => {
    setLoading(true);
    const res = await Bridge.runDoctor();
    if (res.ok && res.data) {
      setItems(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadDoctor();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#141824] border border-[#222938] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold text-slate-100">环境前置体检向导</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          检查 Docker 容器引擎与本地驱动就绪状态，确保开发过程稳定无阻。
        </p>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
            <RotateCw size={18} className="animate-spin text-emerald-400" />
            <span>正在探测本机容器与命令行状态...</span>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <div
                key={item.key}
                className="p-3.5 bg-[#0e1118] border border-[#222938] rounded-xl flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {item.status === 'ok' ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : item.status === 'warning' ? (
                    <AlertTriangle size={16} className="text-amber-400" />
                  ) : (
                    <XCircle size={16} className="text-rose-400" />
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{item.title}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                        item.status === 'ok'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : item.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="text-slate-400 mt-0.5 leading-relaxed">{item.message}</div>

                  {item.fix_hint && (
                    <div className="mt-2 p-2 bg-[#171c28] border border-[#262f44] rounded-lg text-amber-300 text-[11px] leading-relaxed">
                      💡 修复建议: {item.fix_hint}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[#202636]">
          <button
            onClick={loadDoctor}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-slate-300 transition"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>重新体检</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
