import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Search,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowDown,
  Pause,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bridge } from '../services/tauriBridge';
import { LogEntry, LogLevel, LogSource } from '../types';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  isOpen,
  onClose,
  projectPath,
}) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containerLogs, setContainerLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'system' | 'container'>('system');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<LogSource>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await Bridge.getLogs({
        min_level: levelFilter === 'ALL' ? undefined : levelFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        query: searchQuery.trim() || undefined,
        limit: 500,
      });
      if (res.ok && res.data) {
        setLogs(res.data);
      }

      if (projectPath) {
        const cRes = await Bridge.getContainerLogs(projectPath, 100);
        if (cRes.ok && cRes.data) {
          setContainerLogs(cRes.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [isOpen, levelFilter, sourceFilter, searchQuery, projectPath]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, containerLogs, autoScroll]);

  if (!isOpen) return null;

  const handleClear = async () => {
    await Bridge.clearLogs();
    setLogs([]);
    setContainerLogs([]);
  };

  const handleCopy = () => {
    const text =
      activeTab === 'system'
        ? logs
            .map(
              (l) =>
                `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}${
                  l.project_slug ? ` (project=${l.project_slug})` : ''
                }`
            )
            .join('\n')
        : containerLogs.join('\n');

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const res = await Bridge.exportDiagnosticBundle(projectPath);
      if (res.ok && res.data) {
        setExportNotice(t('modals.logs.exportSuccess', { path: res.data }));
      } else {
        setExportNotice(res.error?.plain_message || '导出诊断包失败');
      }
    } catch {
      setExportNotice('导出诊断包失败');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  // Compute level stats
  const errorCount = logs.filter((l) => l.level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.level === 'WARN').length;
  const infoCount = logs.filter((l) => l.level === 'INFO').length;
  const debugCount = logs.filter((l) => l.level === 'DEBUG').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#12151d] border border-[#232938] rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2330] bg-[#161a24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('modals.logs.title')}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                  {logs.length} {t('modals.logs.entries')}
                </span>
                {errorCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1 animate-pulse">
                    <AlertCircle size={10} />
                    {errorCount} {t('modals.logs.errors')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {t('modals.logs.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#1c212e] hover:bg-[#252b3d] border border-[#2d3448] rounded-md transition"
              title={t('modals.logs.exportTooltip')}
            >
              <Download size={13} />
              <span>
                {isExporting ? t('common.loading') : t('modals.logs.exportBtn')}
              </span>
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#1c212e] hover:bg-[#252b3d] border border-[#2d3448] rounded-md transition"
              title={t('modals.logs.copyTooltip')}
            >
              {isCopied ? (
                <Check size={13} className="text-emerald-400" />
              ) : (
                <Copy size={13} />
              )}
              <span>{isCopied ? t('modals.logs.copied') : t('modals.logs.copyBtn')}</span>
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 bg-[#1c212e] hover:bg-rose-500/10 border border-[#2d3448] hover:border-rose-500/30 rounded-md transition"
              title={t('modals.logs.clearTooltip')}
            >
              <Trash2 size={13} />
              <span>{t('modals.logs.clearBtn')}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-[#1f2433] rounded-lg transition ml-1"
              title="关闭日志抽屉 (快捷键 Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Export Notification Banner */}
        {exportNotice && (
          <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-800/40 text-emerald-300 text-xs flex items-center justify-between">
            <span>{exportNotice}</span>
            <button
              onClick={() => setExportNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab & Filter Bar (OrbStack Low-Noise Layout) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#141822] border-b border-[#1e2330]">
          {/* Left: View Tabs & Level Filters */}
          <div className="flex items-center gap-3">
            {/* System vs Container Log Tab */}
            <div className="flex items-center bg-[#1c212e] p-0.5 rounded-md border border-[#2d3448]">
              <button
                onClick={() => setActiveTab('system')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                  activeTab === 'system'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('modals.logs.tabSystem')}
              </button>
              <button
                onClick={() => setActiveTab('container')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                  activeTab === 'container'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('modals.logs.tabContainer')}
              </button>
            </div>

            {/* Level Pills (Active only on system tab) */}
            {activeTab === 'system' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLevelFilter('ALL')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition border ${
                    levelFilter === 'ALL'
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-[#181c27] text-slate-400 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setLevelFilter('ERROR')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition border flex items-center gap-1 ${
                    levelFilter === 'ERROR'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                      : 'bg-[#181c27] text-rose-400/80 border-slate-800 hover:border-rose-500/30'
                  }`}
                >
                  <AlertCircle size={10} />
                  ERROR {errorCount > 0 && `(${errorCount})`}
                </button>
                <button
                  onClick={() => setLevelFilter('WARN')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition border flex items-center gap-1 ${
                    levelFilter === 'WARN'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-[#181c27] text-amber-400/80 border-slate-800 hover:border-amber-500/30'
                  }`}
                >
                  <AlertTriangle size={10} />
                  WARN {warnCount > 0 && `(${warnCount})`}
                </button>
                <button
                  onClick={() => setLevelFilter('INFO')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition border flex items-center gap-1 ${
                    levelFilter === 'INFO'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-[#181c27] text-emerald-400/80 border-slate-800 hover:border-emerald-500/30'
                  }`}
                >
                  <Info size={10} />
                  INFO {infoCount > 0 && `(${infoCount})`}
                </button>
                <button
                  onClick={() => setLevelFilter('DEBUG')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition border ${
                    levelFilter === 'DEBUG'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-[#181c27] text-cyan-400/80 border-slate-800 hover:border-cyan-500/30'
                  }`}
                >
                  DEBUG {debugCount > 0 && `(${debugCount})`}
                </button>
              </div>
            )}
          </div>

          {/* Right: Source filter, Search, and Auto-scroll */}
          <div className="flex items-center gap-2.5">
            {activeTab === 'system' && (
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as LogSource)}
                className="bg-[#1c212e] border border-[#2d3448] text-slate-300 text-xs rounded-md px-2 py-1 outline-none focus:border-emerald-500/50"
              >
                <option value="all">{t('modals.logs.sourceAll')}</option>
                <option value="core">{t('modals.logs.sourceCore')}</option>
                <option value="env">{t('modals.logs.sourceEnv')}</option>
                <option value="runner">{t('modals.logs.sourceRunner')}</option>
                <option value="probe">{t('modals.logs.sourceProbe')}</option>
                <option value="deploy">{t('modals.logs.sourceDeploy')}</option>
              </select>
            )}

            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder={t('modals.logs.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1c212e] border border-[#2d3448] text-slate-200 text-xs rounded-md pl-7 pr-3 py-1 w-44 placeholder:text-slate-500 outline-none focus:border-emerald-500/50"
              />
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition ${
                autoScroll
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#1c212e] text-slate-400 border-[#2d3448]'
              }`}
              title={
                autoScroll
                  ? t('modals.logs.autoScrollOn')
                  : t('modals.logs.autoScrollOff')
              }
            >
              {autoScroll ? <ArrowDown size={12} /> : <Pause size={12} />}
              <span className="text-[11px] font-medium">
                {t('modals.logs.autoScroll')}
              </span>
            </button>
          </div>
        </div>

        {/* Log Stream Output (Monospace, Low-Noise, High Contrast) */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 bg-[#0d1017] font-mono text-xs leading-relaxed space-y-1 select-text min-h-[420px] max-h-[580px]"
        >
          {activeTab === 'system' ? (
            logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 gap-2">
                <Terminal size={28} className="text-slate-600" />
                <p>{t('modals.logs.noLogs')}</p>
              </div>
            ) : (
              logs.map((entry) => {
                const isErr = entry.level === 'ERROR';
                const isWarn = entry.level === 'WARN';
                const isInfo = entry.level === 'INFO';

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-2 py-0.5 px-2 rounded hover:bg-slate-800/40 transition font-mono ${
                      isErr
                        ? 'bg-rose-950/20 text-rose-300 border-l-2 border-rose-500'
                        : isWarn
                        ? 'bg-amber-950/15 text-amber-300 border-l-2 border-amber-500'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 shrink-0 text-[11px]">
                      {entry.timestamp.substring(11, 19)}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                        isErr
                          ? 'bg-rose-500/20 text-rose-400'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-400'
                          : isInfo
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {entry.level}
                    </span>
                    <span className="text-indigo-400/80 text-[11px] shrink-0">
                      [{entry.source}]
                    </span>
                    <span className="break-all whitespace-pre-wrap flex-1">
                      {entry.message}
                    </span>
                    {entry.project_slug && (
                      <span className="text-slate-600 text-[10px] shrink-0">
                        ({entry.project_slug})
                      </span>
                    )}
                  </div>
                );
              })
            )
          ) : containerLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 gap-2">
              <Terminal size={28} className="text-slate-600" />
              <p>{t('modals.logs.noContainerLogs')}</p>
            </div>
          ) : (
            containerLogs.map((line, idx) => (
              <div
                key={idx}
                className="py-0.5 px-2 text-slate-300 hover:bg-slate-800/40 rounded transition"
              >
                <span className="text-slate-600 select-none mr-3 text-[11px]">
                  {idx + 1}
                </span>
                <span className="break-all whitespace-pre-wrap">{line}</span>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-[#141822] border-t border-[#1e2330] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              {t('modals.logs.memoryLimitHint')}
            </span>
            <span>•</span>
            <span>
              {t('modals.logs.diskLimitHint')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1c212e] hover:bg-[#252b3d] text-slate-300 rounded font-medium transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
