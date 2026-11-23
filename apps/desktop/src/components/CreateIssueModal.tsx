import React, { useEffect, useState } from 'react';
import { X, Bug, ArrowRight, Activity, Terminal, Globe, Camera, ShieldCheck } from 'lucide-react';
import { SourceType } from '../types';

interface CreateIssueModalProps {
  isOpen: boolean;
  initialData?: any;
  onClose: () => void;
  onSubmit: (title: string, description: string, expected: string, data: any) => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [hasScreenshot, setHasScreenshot] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setExpected(initialData?.expected_behavior || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title, description, expected, initialData);
    onClose();
  };

  const isScript = initialData?.source_type === 'script_run';

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
          <Bug size={18} className="text-rose-400" />
          <h2 className="text-base font-bold text-slate-100">
            {isScript ? '反馈脚本测试失败 (提 Issue)' : '反馈页面测试问题 (提 Issue)'}
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          用大白话描述您遇到的问题，DevOS 后台已自动打包当前报错堆栈与环境日志供 AI 助手诊断。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">问题简述</label>
            <input
              type="text"
              required
              placeholder={isScript ? '例如：脚本无法解析发票金额字段' : '例如：点击导出 Excel 按钮没有反应'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">详细描述 (发生了什么)</label>
            <textarea
              rows={3}
              required
              placeholder={isScript ? '例如：运行 python scripts/export.py 时抛出 KeyError 异常。' : '例如：在页面勾选了发票记录，点击导出后转圈但没有弹出下载文件。'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">预期效果</label>
            <input
              type="text"
              placeholder={isScript ? '例如：应生成正确的 export_result.xlsx 并正常退出' : '例如：应正常下载 invoices_result.xlsx 文件'}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Context Diagnostics Badge */}
          <div className="p-3 bg-[#0d1017] rounded-lg border border-[#222938] text-[11px] text-slate-400 space-y-1.5">
            <div className="text-emerald-400 font-medium flex items-center gap-1.5">
              <Activity size={13} />
              <span>DevOS 后台已自动关联环境排障包：</span>
            </div>

            {isScript ? (
              <div className="space-y-1 pl-4 text-slate-300 font-mono text-[10px]">
                <div className="flex items-center gap-1">
                  <Terminal size={11} className="text-rose-400" />
                  <span>任务: {initialData?.script?.run_target_id} (退出码: {initialData?.script?.exit_code})</span>
                </div>
                <div>耗时: {initialData?.script?.duration_ms}ms</div>
                <div className="text-slate-400 truncate">命令: {initialData?.script?.command_executed}</div>
              </div>
            ) : (
              <div className="space-y-1 pl-4 text-slate-300 text-[10px]">
                <div className="flex items-center gap-1">
                  <Globe size={11} className="text-emerald-400" />
                  <span className="font-mono">{initialData?.url || '本地 Web 预览'}</span>
                </div>
                <div>• 最近 30 秒浏览器 Console 报错: {initialData?.console_errors?.length || 0} 条</div>
                <div>• 网络 HTTP 异常请求记录: {initialData?.failed_requests?.length || 0} 条</div>
              </div>
            )}

            {/* Screenshot Privacy Control */}
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#222938]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Camera size={12} className={hasScreenshot ? 'text-cyan-400' : 'text-slate-500'} />
                <span>
                  {hasScreenshot
                    ? '已自动抓取问题发生时的画面 (用于辅助 AI 视觉诊断)'
                    : '已移除截图 (仅提交文字描述与错误堆栈)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHasScreenshot(!hasScreenshot)}
                className={`text-[11px] font-medium transition ${
                  hasScreenshot
                    ? 'text-rose-400 hover:text-rose-300 underline'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                {hasScreenshot ? '移除截图 (隐私防窥)' : '保留截图'}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span>所有诊断日志与截图严格仅保存在本地 `.devos/`，绝不上传至任何第三方云端。</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition mt-2 shadow-lg shadow-rose-950/20"
          >
            <span>提交反馈并通知 AI 修复</span>
            <ArrowRight size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};
