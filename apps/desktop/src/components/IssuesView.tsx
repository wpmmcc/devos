import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Check, X, FileCode } from 'lucide-react';
import { Issue, IssueStatus } from '../types';

interface IssuesViewProps {
  issues: Issue[];
  onRetest: (issueId: string, passed: boolean, feedback: string) => void;
  onNavigateToTest: () => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({
  issues,
  onRetest,
  onNavigateToTest,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'ready_for_retest' | 'closed'>('all');
  const [expandedTech, setExpandedTech] = useState<Record<string, boolean>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});

  const filtered = issues.filter((iss) => {
    if (filter === 'open') return iss.status === 'open' || iss.status === 'reopened' || iss.status === 'in_progress';
    if (filter === 'ready_for_retest') return iss.status === 'ready_for_retest';
    if (filter === 'closed') return iss.status === 'closed';
    return true;
  });

  const toggleTech = (id: string) => {
    setExpandedTech((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0d13] p-6 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Header & Filter Tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Issue 反馈与验收闭环</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              测试中发现的问题将自动绑定报错日志与截图，供 AI 助手精准定位与修复。
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#141824] p-1 rounded-lg border border-[#222938]">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'all' ? 'bg-[#22c55e] text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部 ({issues.length})
            </button>
            <button
              onClick={() => setFilter('ready_for_retest')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'ready_for_retest' ? 'bg-[#22c55e] text-slate-950 font-bold' : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              待我复测 ({issues.filter((i) => i.status === 'ready_for_retest').length})
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'open' ? 'bg-[#22c55e] text-slate-950 font-bold' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              待修复 ({issues.filter((i) => i.status === 'open' || i.status === 'reopened').length})
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'closed' ? 'bg-[#22c55e] text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              已关闭 ({issues.filter((i) => i.status === 'closed').length})
            </button>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-4">
          {filtered.map((iss) => {
            const isReadyForRetest = iss.status === 'ready_for_retest';
            const isClosed = iss.status === 'closed';

            return (
              <div
                key={iss.issue_id}
                className={`p-5 rounded-xl border transition ${
                  isReadyForRetest
                    ? 'bg-[#151c27] border-amber-500/40 shadow-lg shadow-amber-950/10'
                    : isClosed
                    ? 'bg-[#11141c] border-[#1d222e] opacity-80'
                    : 'bg-[#141824] border-[#222938]'
                }`}
              >
                {/* Issue Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300">{iss.issue_id}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        iss.status === 'open' || iss.status === 'reopened'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : iss.status === 'ready_for_retest'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {iss.status === 'open'
                        ? '待修复 (open)'
                        : iss.status === 'reopened'
                        ? '复测未过 (reopened)'
                        : iss.status === 'ready_for_retest'
                        ? '待我复测 (ready_for_retest)'
                        : '已解决并关闭 (closed)'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      来源: {iss.source_type === 'web_preview' ? 'Web 页面预览' : '后端脚本运行'}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">{iss.created_at.slice(0, 16).replace('T', ' ')}</span>
                </div>

                {/* User Report Plain Title & Description */}
                <h3 className="text-sm font-semibold text-slate-100 mb-1">{iss.user_report.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{iss.user_report.description}</p>

                {/* Plain Fix Summary Banner (When in ready_for_retest) */}
                {iss.resolution?.fix_summary_plain && (
                  <div className="mt-3.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 size={14} />
                      <span>AI 助手修复说明:</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {iss.resolution.fix_summary_plain}
                    </p>

                    {iss.resolution.changed_files.length > 0 && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                        <FileCode size={12} className="text-slate-400" />
                        <span>修改文件: {iss.resolution.changed_files.join(', ')}</span>
                      </div>
                    )}

                    {/* Retest Actions Buttons */}
                    {isReadyForRetest && (
                      <div className="pt-2 space-y-2 border-t border-emerald-500/20">
                        <input
                          type="text"
                          placeholder="输入复测补充说明（可选，例如：发票金额计算正确）..."
                          value={feedbackInputs[iss.issue_id] || ''}
                          onChange={(e) =>
                            setFeedbackInputs({ ...feedbackInputs, [iss.issue_id]: e.target.value })
                          }
                          className="w-full bg-[#0d1017] border border-[#283042] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={onNavigateToTest}
                            className="px-3 py-1 bg-[#1e2330] hover:bg-[#282f42] text-slate-200 text-xs rounded-md transition font-medium"
                          >
                            去测试台复测
                          </button>
                          <button
                            onClick={() =>
                              onRetest(
                                iss.issue_id,
                                true,
                                feedbackInputs[iss.issue_id] || '经复测确认已修复'
                              )
                            }
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-md transition flex items-center gap-1"
                          >
                            <Check size={12} />
                            <span>验收通过 · 关闭问题</span>
                          </button>
                          <button
                            onClick={() =>
                              onRetest(
                                iss.issue_id,
                                false,
                                feedbackInputs[iss.issue_id] || '复测依然未达预期'
                              )
                            }
                            className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 text-xs rounded-md transition flex items-center gap-1"
                          >
                            <X size={12} />
                            <span>仍有问题 · 重新打开</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Technical Details Accordion */}
                <div className="mt-3 pt-2.5 border-t border-[#1e2330]">
                  <button
                    onClick={() => toggleTech(iss.issue_id)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    <span>{expandedTech[iss.issue_id] ? '收起技术详情' : '查看技术详情与错误堆栈 (给 AI 排障用)'}</span>
                    {expandedTech[iss.issue_id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {expandedTech[iss.issue_id] && (
                    <div className="mt-2.5 p-3 rounded-lg bg-[#0e1118] border border-[#232938] text-[11px] font-mono text-slate-300 space-y-2 overflow-x-auto">
                      {iss.captured_context.web && (
                        <>
                          <div>URL: {iss.captured_context.web.url}</div>
                          {iss.captured_context.web.console_errors.map((c, i) => (
                            <div key={i} className="text-rose-400">Console Error: {c.message}</div>
                          ))}
                        </>
                      )}
                      {iss.captured_context.script && (
                        <>
                          <div>Command: {iss.captured_context.script.command_executed}</div>
                          <div>Exit Code: {iss.captured_context.script.exit_code}</div>
                          <div className="text-rose-400 whitespace-pre-wrap">
                            Stderr: {iss.captured_context.script.stderr_tail}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-xs text-slate-500 border border-dashed border-[#1e2330] rounded-xl">
              没有找到符合条件的反馈记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
