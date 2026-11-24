import React, { useState } from 'react';
import {
  Play,
  Square,
  Camera,
  Terminal,
  TerminalSquare,
  Cpu,
  Languages,
  RotateCcw,
  Activity,
  Search,
  Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DevosProject } from '../types';
import { Bridge } from '../services/tauriBridge';
import { switchLanguage } from '../i18n';

interface TopBarProps {
  project: DevosProject | null;
  activeTab: 'board' | 'test' | 'issues' | 'assets';
  onTabChange: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  openIssuesCount: number;
  testingCount: number;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onOpenTimeMachine?: () => void;
  onOpenLogs?: () => void;
  onShowToast?: (type: 'success' | 'info' | 'warning' | 'error', msg: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  activeTab,
  onTabChange,
  openIssuesCount,
  testingCount,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenTimeMachine,
  onOpenLogs,
  onShowToast,
}) => {
  const { t, i18n } = useTranslation();
  const [isRunning, setIsRunning] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const handleToggleEnv = async () => {
    if (!project || isBusy) return;
    setIsBusy(true);
    if (isRunning) {
      const res = await Bridge.stopEnv('.', 'auto');
      if (res.ok) {
        setIsRunning(false);
        onShowToast?.('info', t('toast.envStopped'));
      } else if (res.error) {
        alert(`${t('common.error')}: ${res.error.plain_message || res.error.message}`);
      }
    } else {
      const res = await Bridge.startEnv('.', 'auto');
      if (res.ok) {
        setIsRunning(true);
        onShowToast?.('success', t('toast.envStarted'));
      } else if (res.error) {
        alert(`${t('common.error')}: ${res.error.plain_message || res.error.message}`);
      }
    }
    setIsBusy(false);
  };

  const handleSnapshot = async () => {
    if (!project) return;
    const name = window.prompt(t('topbar.snapshotPrompt'), '');
    if (name === null) return;
    const res = await Bridge.createSnapshot('.', name);
    if (res.ok) {
      onShowToast?.('success', t('topbar.snapshotSuccess', { id: res.data || name }));
    } else {
      alert(`${t('common.error')}: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  const handleUndoRecentChange = () => {
    if (!project) return;
    if (onOpenTimeMachine) {
      onOpenTimeMachine();
    } else {
      const ok = window.confirm(t('topbar.undoConfirm'));
      if (!ok) return;
      onShowToast?.('info', t('topbar.undoSuccess'));
    }
  };

  if (!project) {
    return (
      <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center px-6">
        <span className="text-xs text-slate-500">{t('topbar.selectProject')}</span>
      </header>
    );
  }

  return (
    <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center justify-between px-5 shrink-0 select-none">
      {/* Left Project Info & Mode */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">{project.name}</span>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          {t('topbar.modeLocalDev', { mode: project.mode })}
        </span>
      </div>

      {/* Center Nav Tabs (4 Core Views with elastic width) */}
      <div className="flex items-center bg-[#181c27] p-1 rounded-lg border border-[#232938]">
        <button
          onClick={() => onTabChange('board')}
          className={`min-w-fit px-3 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'board'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('topbar.tabBoard')}
        </button>

        <button
          onClick={() => onTabChange('test')}
          className={`min-w-fit px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
            activeTab === 'test'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>{t('topbar.tabTest')}</span>
          {testingCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'test'
                  ? 'bg-slate-900 text-emerald-400'
                  : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {testingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('issues')}
          className={`min-w-fit px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
            activeTab === 'issues'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>{t('topbar.tabIssues')}</span>
          {openIssuesCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'issues' ? 'bg-slate-900 text-rose-400' : 'bg-rose-500 text-white'
              }`}
            >
              {openIssuesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('assets')}
          className={`min-w-fit px-3 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'assets'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('topbar.tabAssets')}
        </button>
      </div>

      {/* Right Environment Status & Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Quick Search Shortcut Cmd+K */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#181c27] hover:bg-[#202636] border border-[#232938] rounded-md text-[11px] text-slate-400 hover:text-slate-200 transition"
            title={t('topbar.cmdKHint')}
          >
            <Search size={12} />
            <span className="font-mono text-[10px] text-slate-500">⌘K</span>
          </button>
        )}

        {/* Environment Status Light */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#181c27] border border-[#232938] rounded-md text-[11px] text-slate-300">
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{isRunning ? t('topbar.webRunning') : t('topbar.webStopped')}</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-slate-400">
            <Cpu size={12} className="text-blue-400" />
            <span>{t('topbar.scriptReady')}</span>
          </div>
        </div>

        {/* Start / Stop Toggle */}
        <button
          onClick={handleToggleEnv}
          disabled={isBusy}
          className={`flex items-center gap-1.5 px-3 py-1.2 rounded-md text-xs font-medium border transition ${
            isRunning
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          {isBusy ? (
            <span>{t('topbar.processing')}</span>
          ) : isRunning ? (
            <>
              <Square size={12} />
              <span>{t('topbar.stopEnv')}</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>{t('topbar.startEnv')}</span>
            </>
          )}
        </button>

        {/* Take Snapshot */}
        <button
          onClick={handleSnapshot}
          className="flex items-center gap-1 px-2.5 py-1.2 rounded-md text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-slate-300 transition border border-[#2c3346]"
          title={t('topbar.saveSnapshot')}
        >
          <Camera size={13} />
          <span>{t('topbar.saveSnapshot')}</span>
        </button>

        {/* Undo Recent AI Change (Time Machine) */}
        <button
          onClick={handleUndoRecentChange}
          className="flex items-center gap-1 px-2.5 py-1.2 rounded-md text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-amber-300 transition border border-amber-500/30"
          title={t('topbar.undoAiChange')}
        >
          <RotateCcw size={12} />
          <span>{t('topbar.undoAiChange')}</span>
        </button>

        {/* Global Background Task Bubble */}
        {isBusy && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/40 border border-cyan-800/40 rounded-md text-[11px] text-cyan-300 animate-pulse">
            <Activity size={12} className="animate-spin text-cyan-400" />
            <span>{t('topbar.bgTaskRunning')}</span>
          </div>
        )}

        {/* Open in Agent */}
        <button
          onClick={() =>
            alert(
              `可在外部 Agent 工具（Claude Code / Cursor / Windsurf / Droid 等）中执行:\n\ncd ${project.slug}\ndevos brief`
            )
          }
          className="flex items-center gap-1 px-2.5 py-1.2 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold transition"
        >
          <TerminalSquare size={13} />
          <span>{t('topbar.openInAgent')}</span>
        </button>

        {/* Language Hot-Switch */}
        <button
          onClick={() => {
            const nextLang = i18n.language.startsWith('zh') ? 'en-US' : 'zh-CN';
            switchLanguage(nextLang);
          }}
          className="flex items-center gap-1 px-2 py-1.2 rounded-md text-xs font-mono bg-[#181c27] hover:bg-[#222736] text-slate-300 border border-slate-700/60 transition"
          title={t('common.switchLang')}
        >
          <Languages size={12} className="text-cyan-400" />
          <span>{i18n.language.startsWith('zh') ? 'EN' : '中'}</span>
        </button>

        {/* Logs Button */}
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.2 rounded-md text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-slate-300 hover:text-white transition border border-[#2c3346]"
            title={t('topbar.logs')}
          >
            <Terminal size={13} className="text-emerald-400" />
            <span>{t('topbar.logs')}</span>
          </button>
        )}

        {/* Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#181c27] border border-transparent hover:border-[#232938] transition"
            title={t('common.settings')}
          >
            <Settings size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
