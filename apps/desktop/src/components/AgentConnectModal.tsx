import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Bot,
  CheckCircle2,
  RefreshCw,
  Copy,
  Trash2,
  Terminal,
  FileCode,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AgentDetection, DevosProject } from '../types';
import { Bridge } from '../services/tauriBridge';

interface AgentConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: DevosProject | null;
}

export const AgentConnectModal: React.FC<AgentConnectModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AgentDetection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'installed' | 'configured'>('all');
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const projectPath = project?.workspace_paths ? '.' : undefined;

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const res = await Bridge.detectAgents(projectPath);
      if (res.ok && res.data) {
        setAgents(res.data);
      }
    } catch (err: any) {
      console.error('Failed to detect agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAgents();
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleConnectAgent = async (agentId: string) => {
    setOperatingId(agentId);
    try {
      const res = await Bridge.applyAgentConfig(agentId, projectPath);
      if (res.ok) {
        showToast(res.data || t('agentModal.connectSuccess', '成功接入 DevOS MCP 协议！'));
        await loadAgents();
      } else {
        showToast(
          `${t('common.error', '错误')}: ${
            res.error?.plain_message || res.error?.message || '配置注入失败'
          }`
        );
      }
    } finally {
      setOperatingId(null);
    }
  };

  const handleUninstallAgent = async (agentId: string) => {
    setOperatingId(agentId);
    try {
      const res = await Bridge.uninstallAgentConfig(agentId, projectPath);
      if (res.ok) {
        showToast(res.data || t('agentModal.uninstallSuccess', '已成功解除 DevOS MCP 关联'));
        await loadAgents();
      } else {
        showToast(
          `${t('common.error', '错误')}: ${
            res.error?.plain_message || res.error?.message || '卸载失败'
          }`
        );
      }
    } finally {
      setOperatingId(null);
    }
  };

  const handleBatchConnectAllInstalled = async () => {
    const targetAgents = agents.filter((a) => a.installed && !a.configured);
    if (targetAgents.length === 0) {
      showToast(t('agentModal.noPendingAgents', '当前没有已安装且未配置的 Agent'));
      return;
    }

    setOperatingId('batch');
    let successCount = 0;
    for (const ag of targetAgents) {
      try {
        const res = await Bridge.applyAgentConfig(ag.id, projectPath);
        if (res.ok) successCount++;
      } catch (e) {
        console.error(`Failed to wire ${ag.id}:`, e);
      }
    }
    setOperatingId(null);
    showToast(t('agentModal.batchSuccess', { count: successCount, defaultValue: `批量接入完成：已成功配置 ${successCount} 个 Agent！` }));
    await loadAgents();
  };

  const toggleSnippet = async (agentId: string) => {
    if (expandedSnippetId === agentId) {
      setExpandedSnippetId(null);
      return;
    }
    setExpandedSnippetId(agentId);
    if (!snippets[agentId]) {
      const res = await Bridge.getManualConfigSnippet(agentId);
      if (res.ok && res.data) {
        setSnippets((prev) => ({ ...prev, [agentId]: res.data! }));
      }
    }
  };

  const handleCopySnippetText = (agentId: string, text?: string) => {
    const content = text || snippets[agentId];
    if (content) {
      navigator.clipboard.writeText(content);
      setCopiedId(agentId);
      showToast(t('agentModal.snippetCopied', '配置片段已成功复制至剪贴板'));
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const installedCount = agents.filter((a) => a.installed).length;
  const configuredCount = agents.filter((a) => a.configured).length;

  const filteredAgents = agents.filter((a) => {
    if (filter === 'installed') return a.installed;
    if (filter === 'configured') return a.configured;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[#0d1017] border border-[#202738] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#202738] bg-[#121622]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-100">
                  {t('agentModal.title', '连接 AI Agent 工具 (MCP 协议枢纽)')}
                </h2>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-cyan-500/30">
                  MCP stdio v2024-11-05
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'agentModal.subtitle',
                  'DevOS 标准化 MCP 协议，无缝接入 Antigravity CLI、Cursor、TRAE、Claude、Windsurf 等各类智能体'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAgents}
              disabled={isLoading}
              className="p-2 rounded-lg bg-[#1a202c] hover:bg-[#252d3d] text-slate-300 hover:text-slate-100 transition border border-slate-700/40"
              title={t('common.refresh', '重新扫描')}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title={t('common.close', '关闭')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Project Scope & Quick Actions */}
        <div className="px-6 py-3 bg-[#11141e] border-b border-[#1e2433] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500 font-medium">{t('agentModal.projectScope', '生效目标')}:</span>
            {project ? (
              <span className="font-mono bg-cyan-950/50 text-cyan-300 px-2.5 py-1 rounded border border-cyan-800/40">
                {project.name} ({project.project_id})
              </span>
            ) : (
              <span className="font-mono bg-slate-800/60 text-slate-300 px-2.5 py-1 rounded border border-slate-700/50">
                {t('agentModal.globalScope', '全局环境与当前工作区 (~/.gemini, ~/.cursor 等)')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {installedCount > configuredCount && (
              <button
                onClick={handleBatchConnectAllInstalled}
                disabled={operatingId !== null}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950/40 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Sparkles size={13} />
                <span>
                  {operatingId === 'batch'
                    ? t('agentModal.batchConfiguring', '正在批量接入...')
                    : t('agentModal.batchConnect', '一键为所有已安装 Agent 接入 MCP')}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar & Summary */}
        <div className="px-6 py-2.5 bg-[#0f121a] border-b border-[#1b212f] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('agentModal.filterAll', '全部规范')} ({agents.length})
            </button>
            <button
              onClick={() => setFilter('installed')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filter === 'installed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('agentModal.filterInstalled', '本机已安装')} ({installedCount})
            </button>
            <button
              onClick={() => setFilter('configured')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filter === 'configured'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('agentModal.filterConfigured', '已接入 MCP')} ({configuredCount})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {t('agentModal.binLocation', '二进制')}: ~/.devos/bin/devos-mcp
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mx-6 mt-3 p-3 bg-cyan-950/70 border border-cyan-700/60 rounded-xl text-cyan-200 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-cyan-400 hover:text-cyan-200 text-xs font-mono"
            >
              ×
            </button>
          </div>
        )}

        {/* Scrollable Agent Cards */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {t('agentModal.noMatch', '未找到匹配的智能体规范')}
            </div>
          ) : (
            filteredAgents.map((ag) => {
              const isAntigravity = ag.id === 'antigravity';
              const isOperating = operatingId === ag.id;
              const isExpanded = expandedSnippetId === ag.id;

              return (
                <div
                  key={ag.id}
                  className={`p-4 rounded-xl border transition-all duration-150 ${
                    isAntigravity
                      ? 'bg-gradient-to-r from-[#0e1628] to-[#121824] border-cyan-600/40 shadow-sm'
                      : ag.configured
                      ? 'bg-[#10141f] border-cyan-900/30'
                      : 'bg-[#0d1017] border-[#1e2536] hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                          {ag.name}
                          {isAntigravity && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                              ⭐ 当前 Antigravity 工作台
                            </span>
                          )}
                        </span>

                        {ag.installed ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                            {t('agentModal.installed', '已在本机检测到')}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700/40">
                            {t('agentModal.notInstalled', '未检测到程序')}
                          </span>
                        )}

                        {ag.configured ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={11} />
                            <span>{t('agentModal.configured', '已接入 DevOS MCP')}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/40">
                            {t('agentModal.unconfigured', '未接入')}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {ag.description}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 truncate">
                        <FileCode size={11} className="shrink-0 text-slate-600" />
                        <span className="truncate">{ag.config_path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => toggleSnippet(ag.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-[#171d2b] hover:bg-[#20273a] text-slate-300 border border-slate-700/50 flex items-center gap-1.5 transition"
                        title={t('agentModal.viewSnippet', '查看配置片段')}
                      >
                        <Terminal size={12} />
                        <span>{t('agentModal.configSnippet', '配置片段')}</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {ag.configured ? (
                        <>
                          <button
                            onClick={() => handleConnectAgent(ag.id)}
                            disabled={isOperating}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a2233] text-slate-200 hover:bg-[#242f46] border border-cyan-900/40 transition disabled:opacity-50"
                          >
                            {isOperating
                              ? t('agentModal.checking', '校验中...')
                              : t('agentModal.recheck', '重新自检')}
                          </button>
                          <button
                            onClick={() => handleUninstallAgent(ag.id)}
                            disabled={isOperating}
                            className="p-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 border border-rose-900/30 transition disabled:opacity-50"
                            title={t('agentModal.uninstallTitle', '解除 MCP 配置关联')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnectAgent(ag.id)}
                          disabled={isOperating}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isOperating ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              <span>{t('agentModal.connecting', '正在接入...')}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              <span>{t('agentModal.connectOneClick', '一键接入 MCP')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Snippet Preview */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#1b2233] animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {t('agentModal.snippetTitle', '标准接入代码（可手动添加至对应配置文件）')}:
                        </span>
                        <button
                          onClick={() => handleCopySnippetText(ag.id)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition"
                        >
                          {copiedId === ag.id ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-400">{t('common.copied', '已复制')}</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>{t('common.copy', '复制片段')}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3 bg-[#07090e] border border-[#181d29] rounded-lg text-[11px] font-mono text-cyan-300/90 overflow-x-auto select-all max-h-48">
                        {snippets[ag.id] || t('agentModal.loadingSnippet', '正在生成配置片段...')}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#121622] border-t border-[#202738] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {t(
                'agentModal.footerSafety',
                '5 步安全保护流水线：原子合并、旧配置自动备份、敏感凭据脱敏、断点自愈。'
              )}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1a202c] hover:bg-[#252d3d] text-slate-200 transition font-medium border border-slate-700/50"
          >
            {t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </div>
  );
};
