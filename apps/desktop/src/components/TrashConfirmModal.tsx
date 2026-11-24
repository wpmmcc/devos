import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RecentProjectDto } from '../types';

interface TrashConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: RecentProjectDto | null;
  onConfirm: (project: RecentProjectDto) => Promise<void>;
}

export const TrashConfirmModal: React.FC<TrashConfirmModalProps> = ({
  isOpen,
  onClose,
  project,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !project) return null;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm(project);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
          title="关闭弹窗 (快捷键 Esc)"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <Trash2 size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              安全移入回收站
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              项目: <span className="text-slate-100 font-semibold">{project.name}</span>
            </p>
          </div>
        </div>

        <div className="p-3 bg-[#0d1017] border border-[#222938] rounded-xl text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <ShieldCheck size={14} />
            <span>DevOS 源码心血安全防护</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            项目将被安全移动至 <span className="font-mono text-slate-300">~/.devos/trash/</span> 归档。
            DevOS 绝不永久硬删除您的代码，如有需要可随时在回收站目录中找回！
          </p>
          <div className="text-[10px] text-slate-500 font-mono break-all pt-1 border-t border-slate-800">
            路径: {project.path}
          </div>
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
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition shadow-md shadow-rose-950/40"
          >
            {isDeleting ? (
              <span>正在移入回收站...</span>
            ) : (
              <>
                <Trash2 size={13} />
                <span>确认移入回收站</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
