import React, { useEffect, useState } from 'react';
import { Bridge } from '../services/tauriBridge';

interface ConflictDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  onResolved?: () => void;
}

export const ConflictDoctorModal: React.FC<ConflictDoctorModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  onResolved,
}) => {
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [port80Info, setPort80Info] = useState<any>(null);
  const [port443Info, setPort443Info] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  const checkPorts = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res80 = await Bridge.inspectPortOccupant(80);
      if (res80.ok && res80.data) {
        setPort80Info(res80.data);
      }
      const res443 = await Bridge.inspectPortOccupant(443);
      if (res443.ok && res443.data) {
        setPort443Info(res443.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkPorts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasConflict = port80Info?.is_occupied || port443Info?.is_occupied;

  const handleAutoAvoid = async () => {
    setResolving(true);
    try {
      const res = await Bridge.reconfigureWebPorts(projectPath, 18080, 18443);
      if (res.ok) {
        setMessage('已成功切换为备用端口 (18080/18443)，并已刷新项目配置！');
        if (onResolved) onResolved();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage('自动换用端口失败: ' + (res.error?.plain_message || res.error?.message));
      }
    } catch (err: any) {
      setMessage('操作异常: ' + String(err));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🩺</span>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">
              端口冲突自愈诊断室 (Conflict Doctor)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="关闭诊断室 (快捷键 Esc)"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-lg border border-blue-200 dark:border-blue-800">
            {message}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-sm">正在深度探测本机端口与占用进程...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm flex flex-col gap-2 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">HTTP 80 端口:</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    port80Info?.is_occupied
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}
                >
                  {port80Info?.is_occupied ? '被宿主机占用' : '空闲可用'}
                </span>
              </div>
              {port80Info?.is_occupied && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-amber-400">
                  进程: <strong className="text-slate-700 dark:text-slate-200">{port80Info.process_name || '系统服务'}</strong>
                  {port80Info.pid ? ` (PID: ${port80Info.pid})` : ''}
                  {port80Info.command_line && (
                    <div className="truncate font-mono text-[11px] text-slate-400 mt-0.5">{port80Info.command_line}</div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm flex flex-col gap-2 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">HTTPS 443 端口:</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    port443Info?.is_occupied
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}
                >
                  {port443Info?.is_occupied ? '被宿主机占用' : '空闲可用'}
                </span>
              </div>
              {port443Info?.is_occupied && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-amber-400">
                  进程: <strong className="text-slate-700 dark:text-slate-200">{port443Info.process_name || '系统服务'}</strong>
                  {port443Info.pid ? ` (PID: ${port443Info.pid})` : ''}
                  {port443Info.command_line && (
                    <div className="truncate font-mono text-[11px] text-slate-400 mt-0.5">{port443Info.command_line}</div>
                  )}
                </div>
              )}
            </div>

            {hasConflict ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 leading-relaxed">
                💡 <strong>宿主机零侵入提示：</strong> 本机已运行 Nginx、IIS 或其他本地服务占用 80/443。建议点击下方推荐操作，DevOS 会自动换用高位端口（18080/18443），无需终止您电脑上正在运行的其他软件。
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                ✅ 标准 80/443 端口未被其他服务占用，可直接以标准域名启动。
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={checkPorts}
            disabled={loading || resolving}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            重新检测
          </button>
          {hasConflict && (
            <button
              onClick={handleAutoAvoid}
              disabled={loading || resolving}
              className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {resolving ? '配置中...' : '自动换用空闲端口启动 (推荐)'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
