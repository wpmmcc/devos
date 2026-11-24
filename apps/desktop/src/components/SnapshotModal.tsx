import React, { useState, useEffect } from 'react';
import { Camera, X, Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DevosProject } from '../types';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DevosProject | null;
  onConfirm: (name: string) => Promise<void>;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  isOpen,
  onClose,
  project,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [snapshotName, setSnapshotName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const defaultName = `snapshot_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
        now.getDate()
      )}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      setSnapshotName(defaultName);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(snapshotName.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#222938] rounded-2xl max-w-md w-full p-6 shadow-2xl relative flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
          title="关闭弹窗 (快捷键 Esc)"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Camera size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              创建环境与数据库快照
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              目标项目: <span className="text-slate-200 font-semibold">{project?.name || '当前项目'}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          DevOS 将即时冻结当前的 SQLite 数据库状态、配置文件与环境快照。随时可在「时光机」中一键对比并安全回滚。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              快照标识 (Snapshot Name)
            </label>
            <input
              type="text"
              autoFocus
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="例如：baseline_v1"
              className="w-full bg-[#0d1017] border border-[#222938] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-mono transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#1a1f2c] transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!snapshotName.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition shadow-md shadow-amber-950/30"
            >
              {isSubmitting ? (
                <span>正在保存快照...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>立即创建快照</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
