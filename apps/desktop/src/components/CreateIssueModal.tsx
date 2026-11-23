import React, { useState } from 'react';
import { X, Bug, ArrowRight } from 'lucide-react';
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
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [expected, setExpected] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title, description, expected, initialData);
    onClose();
  };

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
          <h2 className="text-base font-bold text-slate-100">反馈测试问题 (提 Issue)</h2>
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
              placeholder="例如：点击导出 Excel 按钮没有反应"
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
              placeholder="例如：在页面勾选了发票记录，点击导出后转圈但没有弹出下载文件。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">预期效果</label>
            <input
              type="text"
              placeholder="例如：应正常下载 invoices_result.xlsx 文件"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-3 bg-[#0d1017] rounded-lg border border-[#222938] text-[11px] text-slate-400 space-y-1">
            <div className="text-emerald-400 font-medium">✓ 后台已自动关联环境排障包：</div>
            <div>• 最近 30 秒浏览器 Console 报错与 HTTP 500 请求日志</div>
            <div>• 容器标准输出与错误堆栈信息</div>
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
