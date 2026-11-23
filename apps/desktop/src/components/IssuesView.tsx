import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  FileCode,
  Copy,
  Bot,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Issue } from '../types';

interface IssuesViewProps {
  issues: Issue[];
  onRetest: (issueId: string, passed: boolean, feedback: string) => void;
  onNavigateToTest: () => void;
  projectName?: string;
  projectId?: string;
  onShowToast?: (type: 'success' | 'info' | 'warning' | 'error', msg: string, actionText?: string, copyText?: string) => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({
  issues,
  onRetest,
  onNavigateToTest,
  projectName,
  projectId,
  onShowToast,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'open' | 'ready_for_retest' | 'closed'>('all');
  const [expandedTech, setExpandedTech] = useState<Record<string, boolean>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});

  const handleCopyInstruction = (iss: Issue) => {
    const text = `请处理「${projectName || '当前项目'}」(${projectId || 'proj_id'}) 的 ${iss.issue_id}: ${iss.user_report.title}`;
    navigator.clipboard.writeText(text);
    if (onShowToast) {
      onShowToast('info', t('issues.copySuccess', { text }), t('common.copy'), text);
    } else {
      alert(t('issues.copySuccess', { text }));
    }
  };

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
    <div className="flex-1 flex flex-col bg-[#0b0d13] p-6 overflow-y-auto select-none">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Header & Filter Tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{t('issues.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('issues.subtitle')}</p>
          </div>

          <div className="flex items-center gap-1 bg-[#141824] p-1 rounded-lg border border-[#222938]">
            <button
              onClick={() => setFilter('all')}
              className={`min-w-fit px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-[#22c55e] text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('issues.filterAll', { count: issues.length })}
            </button>
            <button
              onClick={() => setFilter('ready_for_retest')}
              className={`min-w-fit px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'ready_for_retest'
                  ? 'bg-[#22c55e] text-slate-950 font-bold'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              {t('issues.filterReady', {
                count: issues.filter((i) => i.status === 'ready_for_retest').length,
              })}
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`min-w-fit px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'open'
                  ? 'bg-[#22c55e] text-slate-950 font-bold'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              {t('issues.filterOpen', {
                count: issues.filter((i) => i.status === 'open' || i.status === 'reopened').length,
              })}
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`min-w-fit px-3 py-1 rounded text-xs font-medium transition ${
                filter === 'closed'
                  ? 'bg-[#22c55e] text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('issues.filterClosed', {
                count: issues.filter((i) => i.status === 'closed').length,
              })}
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
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {iss.issue_id}
                    </span>
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
                        ? t('issues.statusOpen')
                        : iss.status === 'reopened'
                        ? t('issues.statusReopened')
                        : iss.status === 'ready_for_retest'
                        ? t('issues.statusReady')
                        : t('issues.statusClosed')}
                    </span>
                    {iss.claimed_by && (
                      <span className="text-[10px] text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-700/50 flex items-center gap-1 font-mono">
                        <Bot size={11} className="text-cyan-400" />
                        <span>{t('issues.claimedBy', { agent: iss.claimed_by.agent_name })}</span>
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {t('common.status')}: {iss.source_type === 'web_preview' ? t('issues.sourceWeb') : t('issues.sourceScript')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyInstruction(iss)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 px-2.5 py-1 rounded border border-cyan-800/40 transition font-medium"
                      title={t('issues.copyAiCommand')}
                    >
                      <Copy size={11} />
                      <span>{t('issues.copyAiCommand')}</span>
                    </button>
                    <span className="text-[11px] text-slate-500">
                      {iss.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                </div>

                {/* User Report Plain Title & Description */}
                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                  {iss.user_report.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {iss.user_report.description}
                </p>

                {/* Plain Fix Summary Banner (When in ready_for_retest) */}
                {iss.resolution?.fix_summary_plain && (
                  <div className="mt-3.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 size={14} />
                      <span>{t('issues.fixSummary')}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {iss.resolution.fix_summary_plain}
                    </p>

                    {iss.resolution.changed_files.length > 0 && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                        <FileCode size={12} className="text-slate-400" />
                        <span>
                          {t('issues.changedFiles', {
                            files: iss.resolution.changed_files.join(', '),
                          })}
                        </span>
                      </div>
                    )}

                    {/* Retest Actions Buttons */}
                    {isReadyForRetest && (
                      <div className="pt-2 space-y-2 border-t border-emerald-500/20">
                        <input
                          type="text"
                          placeholder={t('issues.retestPlaceholder')}
                          value={feedbackInputs[iss.issue_id] || ''}
                          onChange={(e) =>
                            setFeedbackInputs({
                              ...feedbackInputs,
                              [iss.issue_id]: e.target.value,
                            })
                          }
                          className="w-full bg-[#0d1017] border border-[#283042] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={onNavigateToTest}
                            className="px-3 py-1 bg-[#1e2330] hover:bg-[#282f42] text-slate-200 text-xs rounded-md transition font-medium"
                          >
                            {t('issues.goToRetest')}
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
                            <span>{t('issues.retestPass')}</span>
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
                            <span>{t('issues.retestFail')}</span>
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
                    <span>
                      {expandedTech[iss.issue_id]
                        ? t('issues.hideTechDetails')
                        : t('issues.techDetails')}
                    </span>
                    {expandedTech[iss.issue_id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {expandedTech[iss.issue_id] && (
                    <div className="mt-2.5 p-3 rounded-lg bg-[#0e1118] border border-[#232938] text-[11px] font-mono text-slate-300 space-y-2 overflow-x-auto">
                      {iss.captured_context.web && (
                        <>
                          <div>URL: {iss.captured_context.web.url}</div>
                          {iss.captured_context.web.console_errors.map((c, i) => (
                            <div key={i} className="text-rose-400">
                              Console Error: {c.message}
                            </div>
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
            <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-[#1e2330] rounded-xl space-y-2">
              <p>{t('issues.noIssues')}</p>
              <button
                onClick={onNavigateToTest}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <span>{t('issues.goToAccept')}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
