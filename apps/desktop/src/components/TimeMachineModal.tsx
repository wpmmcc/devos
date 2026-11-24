import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History,
  X,
  Plus,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Bridge } from '../services/tauriBridge';

interface Checkpoint {
  id: string;
  created_at: string;
  note: string;
  source: string;
  commit_ref?: string;
}

interface TimeMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
}

export const TimeMachineModal: React.FC<TimeMachineModalProps> = ({
  isOpen,
  onClose,
  projectPath = '.',
}) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadCheckpoints = async () => {
    setIsLoading(true);
    try {
      const res = await Bridge.listCheckpoints(projectPath);
      if (res.ok && res.data) {
        setCheckpoints(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCheckpoints();
      setNewNote('');
      setStatusMessage(null);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const note = newNote.trim() || (isEn ? 'Manual checkpoint snapshot' : '用户手动时光机快照');
    setIsCreating(true);
    try {
      const res = await Bridge.createCheckpoint(projectPath, note, 'user_manual');
      if (res.ok) {
        setNewNote('');
        setStatusMessage(isEn ? 'Checkpoint created successfully!' : '时光机快照已安全创建！');
        await loadCheckpoints();
      } else {
        setStatusMessage(res.error?.message || '创建快照失败');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (cp: Checkpoint) => {
    const confirmMsg = isEn
      ? `Are you sure you want to restore to checkpoint "${cp.note}" (${cp.id})?\n\nWorking tree will be cleanly reverted without modifying your git commit history.`
      : `确认将代码工作区恢复至快照「${cp.note}」(${cp.id})？\n\n当前未提交的工作区代码将被覆盖，快照机制不会篡改您的公开 Git 历史。`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setOperatingId(cp.id);
    try {
      const res = await Bridge.restoreCheckpoint(projectPath, cp.id);
      if (res.ok) {
        setStatusMessage(isEn ? `Reverted to ${cp.id} successfully!` : `已成功秒级还原至快照 ${cp.id}！`);
        await loadCheckpoints();
      } else {
        setStatusMessage(res.error?.message || (isEn ? 'Restore failed' : '时光机回滚失败'));
      }
    } finally {
      setOperatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#10141d] border border-[#222938] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2536] flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-cyan-400">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{isEn ? 'VCS Time Machine' : '轻量代码时光机'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  refs/devos/checkpoints
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn
                  ? 'Zero Git pollution snapshots: isolated snapshots before agent runs with 1-click instant rollback.'
                  : '无污染独立快照：Agent 动代码前自动存盘，支持随时一键秒级找回与回滚。'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-[#1a202e] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-cyan-400" />
              <span>{statusMessage}</span>
            </span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-cyan-400 hover:text-cyan-200 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Create Manual Checkpoint Bar */}
        <div className="px-6 py-3.5 bg-[#141924] border-b border-[#202738] flex items-center gap-2.5">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder={
              isEn
                ? 'Enter note for manual snapshot (e.g. Before changing payment logic)...'
                : '输入快照备忘说明（如：重构订单结算逻辑前手动存盘）...'
            }
            className="flex-1 bg-[#0c1017] border border-[#2a3245] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shrink-0"
          >
            {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            <span>{isEn ? 'Create Snapshot' : '创建即时快照'}</span>
          </button>
        </div>

        {/* Checkpoint List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-cyan-400" />
              <span className="text-xs">{isEn ? 'Loading checkpoints...' : '正在检索历史快照...'}</span>
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History size={36} className="mx-auto text-slate-600" />
              <div className="text-sm text-slate-300 font-medium">
                {isEn ? 'No checkpoints yet' : '暂无时光机快照'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isEn
                  ? 'Checkpoints are automatically taken when AI agents modify files, or you can create one manually above.'
                  : '外部 AI Agent 在修改项目时会自动创建时光机快照，您也可在上方输入说明随时手动存盘。'}
              </p>
            </div>
          ) : (
            checkpoints.map((cp) => {
              const isAuto = cp.source === 'agent_auto';
              const dateStr = new Date(cp.created_at).toLocaleString();

              return (
                <div
                  key={cp.id}
                  className="p-3.5 rounded-xl bg-[#0c1017] border border-[#1f2637] hover:border-cyan-500/30 transition flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                          isAuto
                            ? 'bg-purple-950/40 text-purple-300 border-purple-800/40'
                            : 'bg-cyan-950/40 text-cyan-300 border-cyan-800/40'
                        }`}
                      >
                        {isAuto ? (isEn ? '🤖 Agent Auto' : '🤖 AI 自动快照') : (isEn ? '👤 User Manual' : '👤 用户手动')}
                      </span>
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {cp.note}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock size={11} />
                        <span>{dateStr}</span>
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">{cp.id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(cp)}
                    disabled={operatingId === cp.id}
                    className="px-3 py-1.5 bg-[#171e2c] hover:bg-rose-950/30 text-slate-300 hover:text-rose-300 border border-[#263147] hover:border-rose-500/40 rounded-lg text-xs transition flex items-center gap-1.5 shrink-0"
                    title={isEn ? 'Rollback project files to this checkpoint' : '回滚项目工作区到该快照'}
                  >
                    {operatingId === cp.id ? (
                      <Loader2 size={12} className="animate-spin text-rose-400" />
                    ) : (
                      <RotateCcw size={12} className="text-rose-400" />
                    )}
                    <span>{isEn ? 'Restore' : '时光回退'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#0b0e14] border-t border-[#1e2536] text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-cyan-400" />
            <span>
              {isEn
                ? 'Checkpoints use git detached tree objects and never touch your active branches.'
                : '快照底层使用 detached commit-tree，绝对不改变当前 Git 分支与推送历史。'}
            </span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 text-xs transition"
          >
            {isEn ? 'Close' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
};
