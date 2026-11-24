import React, { useState, useEffect } from 'react';
import {
  Trash2,
  X,
  RotateCcw,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  Archive,
  HardDrive,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TrashedProject } from '../types';
import { Bridge } from '../services/tauriBridge';

interface TrashViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectRestored?: (restoredPath: string) => void;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const TrashViewerModal: React.FC<TrashViewerModalProps> = ({
  isOpen,
  onClose,
  onProjectRestored,
  showToast,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrashedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);

  const fetchTrashList = async () => {
    setLoading(true);
    try {
      const resp = await Bridge.listTrash();
      if (resp.ok && resp.data) {
        setItems(resp.data);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Failed to list trash items', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrashList();
      setConfirmDeleteId(null);
      setConfirmEmpty(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalBytes = items.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);

  const handleRestore = async (item: TrashedProject) => {
    setRestoringId(item.trash_id);
    try {
      const resp = await Bridge.restoreFromTrash(item.trash_id);
      if (resp.ok && resp.data) {
        showToast?.('success', `项目「${item.name}」已成功恢复并重新索引！`);
        await fetchTrashList();
        onProjectRestored?.(resp.data);
      } else {
        showToast?.('error', resp.error?.plain_message || resp.error?.message || '恢复项目失败');
      }
    } catch (err: any) {
      showToast?.('error', `恢复出错: ${err?.message || err}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeletePermanent = async (trashId: string) => {
    setDeletingId(trashId);
    try {
      const resp = await Bridge.deleteTrashItem(trashId);
      if (resp.ok) {
        showToast?.('success', '项目已从回收站彻底粉碎删除');
        await fetchTrashList();
      } else {
        showToast?.('error', resp.error?.plain_message || '删除失败');
      }
    } catch (err: any) {
      showToast?.('error', `删除出错: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleEmptyTrash = async () => {
    setIsEmptying(true);
    try {
      const resp = await Bridge.emptyTrash();
      if (resp.ok) {
        showToast?.('success', `回收站已完全清空，共释放 ${formatBytes(resp.data || 0)} 磁盘空间`);
        await fetchTrashList();
      } else {
        showToast?.('error', resp.error?.plain_message || '清空回收站失败');
      }
    } catch (err: any) {
      showToast?.('error', `清空出错: ${err?.message || err}`);
    } finally {
      setIsEmptying(false);
      setConfirmEmpty(false);
    }
  };

  const handleOpenTrashDir = async () => {
    await Bridge.openTrashDir();
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#232b3e] rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
          title="关闭弹窗 (Esc)"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2330]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">项目回收站 (Project Trash)</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1b2130] text-slate-400 border border-[#2b354d]">
                  {items.length} 个归档 · {formatBytes(totalBytes)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                安全保留已移出的项目文件，支持一键无损还原或彻底粉碎
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <button
              onClick={handleOpenTrashDir}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a1f2c] hover:bg-[#232a3b] text-slate-300 border border-[#2c364c] transition"
              title="在操作系统访达/文件管理器中打开 ~/.devos/trash 目录"
            >
              <FolderOpen size={13} />
              <span>打开目录</span>
            </button>
            <button
              onClick={fetchTrashList}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1f2c] border border-transparent hover:border-[#2c364c] transition"
              title="刷新回收站列表"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Global Toolbar / Empty confirmation */}
        {items.length > 0 && (
          <div className="py-2.5 px-3 bg-[#0d1017] border-b border-[#1e2330] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Archive size={13} className="text-slate-500" />
              <span>存储位置: <code className="text-slate-300 font-mono">~/.devos/trash/</code></span>
            </div>

            {confirmEmpty ? (
              <div className="flex items-center gap-2 animate-in fade-in">
                <span className="text-[11px] text-rose-400 font-semibold">确认清空回收站（不可逆）？</span>
                <button
                  onClick={handleEmptyTrash}
                  disabled={isEmptying}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition"
                >
                  {isEmptying ? '清空中...' : '确定清空'}
                </button>
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="px-2 py-1 rounded bg-[#1e2433] hover:bg-[#283044] text-slate-300 text-[11px] transition"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEmpty(true)}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 hover:underline transition"
              >
                <Trash2 size={12} />
                <span>清空回收站</span>
              </button>
            )}
          </div>
        )}

        {/* Body / List */}
        <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-2.5 pr-1">
          {loading && items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw size={24} className="animate-spin text-emerald-400" />
              <p className="text-xs">正在扫描回收站归档...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#161a25] border border-[#232938] flex items-center justify-center text-slate-600">
                <Trash2 size={28} />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">回收站为空</h3>
              <p className="text-xs text-slate-500 max-w-sm text-center leading-relaxed">
                当您从项目列表中点击「移除」时，项目将被安全归档至此处，绝不会丢失源码心血。
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isConfirmingDelete = confirmDeleteId === item.trash_id;
              const isRestoring = restoringId === item.trash_id;
              const isDeleting = deletingId === item.trash_id;

              return (
                <div
                  key={item.trash_id}
                  className="bg-[#10131d] border border-[#1f2535] hover:border-[#2f3952] rounded-xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-100 text-sm">{item.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-[#1a1f2c] border border-[#252c3e]">
                        {item.slug}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.project_type === 'web'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : item.project_type === 'script'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {item.project_type}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar size={11} />
                        <span>移除于 {formatDate(item.trashed_at)}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <HardDrive size={11} />
                        <span>大小: {formatBytes(item.size_bytes)}</span>
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono truncate" title={item.original_path}>
                      原路径: {item.original_path}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Restore Button */}
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={isRestoring || isDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition disabled:opacity-50"
                      title="一键无损恢复项目至原路径，并重新加入近期项目与侧边栏"
                    >
                      <RotateCcw size={12} className={isRestoring ? 'animate-spin' : ''} />
                      <span>{isRestoring ? '恢复中...' : '一键恢复'}</span>
                    </button>

                    {/* Reveal in Finder */}
                    <button
                      onClick={() => Bridge.openInFinder(`~/.devos/trash/${item.trash_id}`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1f2c] border border-[#252c3e] transition"
                      title="在访达中定位归档目录"
                    >
                      <FolderOpen size={13} />
                    </button>

                    {/* Delete Permanent */}
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 animate-in fade-in">
                        <button
                          onClick={() => handleDeletePermanent(item.trash_id)}
                          disabled={isDeleting}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
                        >
                          {isDeleting ? '粉碎中...' : '确认粉碎'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-[#1a1f2c] transition"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.trash_id)}
                        disabled={isRestoring || isDeleting}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition disabled:opacity-50"
                        title="彻底粉碎删除（不可撤销）"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#1e2330] flex items-center justify-between text-xs text-slate-500">
          <span>提示：恢复项目时，DevOS 会自动校验原路径冲突并无损重建工程索引与卡片。</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium bg-[#1a1f2c] hover:bg-[#252c3e] text-slate-300 transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
