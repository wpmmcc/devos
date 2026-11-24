import React, { useState, useRef, useEffect } from 'react';
import {
  Cpu,
  Search,
  Camera,
  Layers,
  Globe,
  Database,
  Mail,
  Terminal,
  Wrench,
  ExternalLink,
  ChevronDown,
  Menu,
  X,
  Kanban,
  FlaskConical,
  Bug,
  BookOpen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DevosProject } from '../types';

interface TopBarProps {
  project: DevosProject | null;
  activeTab: 'board' | 'test' | 'issues' | 'assets';
  onTabChange: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  openIssuesCount: number;
  testingCount: number;
  isEnvRunning?: boolean;
  onOpenCommandPalette?: () => void;
  onOpenSnapshotModal?: () => void;
  onRebuildEnv?: () => void;
  onOpenTerminal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  activeTab,
  onTabChange,
  openIssuesCount,
  testingCount,
  isEnvRunning = true,
  onOpenCommandPalette,
  onOpenSnapshotModal,
  onRebuildEnv,
  onOpenTerminal,
}) => {
  const { t } = useTranslation();
  const [showTopology, setShowTopology] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const topologyRef = useRef<HTMLDivElement>(null);

  // Close topology popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topologyRef.current && !topologyRef.current.contains(e.target as Node)) {
        setShowTopology(false);
      }
    };
    if (showTopology) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTopology]);

  if (!project) {
    return (
      <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center px-6">
        <span className="text-xs text-slate-500">{t('topbar.selectProject')}</span>
      </header>
    );
  }

  const primaryWebUrl = project.environments.web?.primary_url || 'http://localhost:8080';

  return (
    <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center justify-between px-3 sm:px-4 shrink-0 select-none whitespace-nowrap overflow-visible relative z-30">
      {/* Left Project Info & Mode */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
        {/* Mobile Hamburger Toggle for <1024px */}
        <div className="md:hidden relative">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-1.5 rounded-lg bg-[#181c27] border border-[#232938] text-slate-300 hover:text-white"
            title="切换视图菜单"
          >
            {showMobileMenu ? <X size={15} /> : <Menu size={15} />}
          </button>

          {showMobileMenu && (
            <div className="absolute top-10 left-0 w-44 bg-[#141824] border border-[#232b3d] rounded-xl shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in duration-100">
              <button
                onClick={() => {
                  onTabChange('board');
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                  activeTab === 'board' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#1e2434]'
                }`}
              >
                <Kanban size={13} />
                <span>{t('topbar.tabBoard')}</span>
              </button>
              <button
                onClick={() => {
                  onTabChange('test');
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                  activeTab === 'test' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#1e2434]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FlaskConical size={13} />
                  <span>{t('topbar.tabTest')}</span>
                </span>
                {testingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {testingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  onTabChange('issues');
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                  activeTab === 'issues' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#1e2434]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bug size={13} />
                  <span>{t('topbar.tabIssues')}</span>
                </span>
                {openIssuesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {openIssuesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  onTabChange('assets');
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                  activeTab === 'assets' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#1e2434]'
                }`}
              >
                <BookOpen size={13} />
                <span>{t('topbar.tabAssets')}</span>
              </button>
            </div>
          )}
        </div>

        <span
          className="text-xs sm:text-sm font-semibold text-slate-100 truncate max-w-[120px] sm:max-w-[200px] xl:max-w-[280px]"
          title={`当前活跃项目: ${project.name}\n工作区模式: ${project.mode}`}
        >
          {project.name}
        </span>
        <span
          className="hidden md:inline-flex text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0"
          title={`当前处于开发态，支持双向代码热更新与容器隔离`}
        >
          {t('topbar.modeLocalDev', { mode: project.mode })}
        </span>
      </div>

      {/* Center Nav Tabs (4 Core Views) - hidden on mobile / small split view */}
      <div className="hidden md:flex items-center bg-[#181c27] p-1 rounded-lg border border-[#232938] shrink-0 mx-1">
        <button
          onClick={() => onTabChange('board')}
          className={`min-w-fit px-2.5 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'board'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="任务看板: 查看待开发、开发中、待我测试与已完成任务泳道"
        >
          {t('topbar.tabBoard')}
        </button>

        <button
          onClick={() => onTabChange('test')}
          className={`min-w-fit px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1 ${
            activeTab === 'test'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="测试预览: 真源 Web 页面预览与后端自动化测试脚本执行台"
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
          className={`min-w-fit px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1 ${
            activeTab === 'issues'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="问题反馈: 收集测试中的报错与缺陷，一键打包复制指令供 AI 修复"
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
          className={`min-w-fit px-2.5 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'assets'
              ? 'bg-[#22c55e] text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="规范资产: 统一维护需求文档、硬编码标准、运行清单与存储自愈"
        >
          {t('topbar.tabAssets')}
        </button>
      </div>

      {/* Right Environment Status, Topology, Snapshot & Quick Command Palette */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Environment Status Badge & Topology Launcher */}
        <div className="relative" ref={topologyRef}>
          <button
            onClick={() => setShowTopology(!showTopology)}
            className="flex items-center gap-2 px-2.5 py-1 bg-[#181c27] hover:bg-[#1e2434] border border-[#232938] rounded-md text-[11px] text-slate-300 transition"
            title="点击展开容器集群拓扑 (Web、Database、Mailpit、Shell)"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isEnvRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isEnvRunning ? t('topbar.webRunning') : t('topbar.webStopped')}</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1 text-slate-400">
              <Layers size={12} className="text-blue-400" />
              <span>拓扑</span>
            </div>
            <ChevronDown size={11} className={`text-slate-500 transition-transform ${showTopology ? 'rotate-180' : ''}`} />
          </button>

          {/* Multi-Service Container Topology Card Dropdown */}
          {showTopology && (
            <div className="absolute right-0 top-10 w-80 bg-[#121622] border border-[#232b3d] rounded-2xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[#1d2535] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-blue-500/20 text-blue-400">
                    <Layers size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">容器服务集群拓扑</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {project.environments.web?.driver || 'devcontainer'} · {isEnvRunning ? '运行就绪' : '已停止'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowTopology(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Service Cards */}
              <div className="space-y-2 text-xs">
                {/* 1. Web Service */}
                <div className="p-2.5 bg-[#0b0e15] border border-[#1e2535] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
                      <Globe size={13} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200">Web 业务服务</div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        {primaryWebUrl}
                      </div>
                    </div>
                  </div>
                  <a
                    href={primaryWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-[#161c28] hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition"
                    title="在浏览器中打开主站"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* 2. Database Service */}
                <div className="p-2.5 bg-[#0b0e15] border border-[#1e2535] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-400">
                      <Database size={13} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200">数据库服务 (DB)</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Port 3306 / 5432 · MySQL/PostgreSQL
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-950/30 border border-emerald-800/30">
                    Active
                  </span>
                </div>

                {/* 3. Auxiliary Mailpit */}
                <div className="p-2.5 bg-[#0b0e15] border border-[#1e2535] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-400">
                      <Mail size={13} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200">Mailpit 邮件调试器</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Port 8025 · 本地邮件拦截
                      </div>
                    </div>
                  </div>
                  <a
                    href="http://localhost:8025"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-[#161c28] hover:bg-purple-500/20 text-slate-400 hover:text-purple-400 transition"
                    title="打开 Mailpit 邮件捕获面板"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Quick Actions in Topology */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1d2535]">
                <button
                  onClick={() => {
                    setShowTopology(false);
                    onOpenTerminal?.();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#181c28] hover:bg-[#222838] text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Terminal size={12} className="text-cyan-400" />
                  <span>容器 Shell</span>
                </button>
                <button
                  onClick={() => {
                    setShowTopology(false);
                    onRebuildEnv?.();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#181c28] hover:bg-[#222838] text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Wrench size={12} className="text-emerald-400" />
                  <span>重建容器</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Environment Snapshot Button */}
        {onOpenSnapshotModal && (
          <button
            onClick={onOpenSnapshotModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#181c27] hover:bg-[#202636] border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-md text-xs font-medium transition shrink-0"
            title="环境快照: 创建当前数据库与环境运行状态快照 (随时可在时光机中查看)"
          >
            <Camera size={13} className="text-amber-400" />
            <span className="hidden sm:inline">{t('topbar.saveSnapshot')}</span>
          </button>
        )}

        {/* Quick Search Shortcut Cmd+K */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#181c27] hover:bg-[#202636] border border-[#232938] rounded-md text-[11px] text-slate-400 hover:text-slate-200 transition"
            title="全局指令面板: 快速搜索与触发动作 (快捷键 ⌘K)"
          >
            <Search size={12} />
            <span className="font-mono text-[10px] text-slate-400 font-semibold">⌘K</span>
          </button>
        )}
      </div>
    </header>
  );
};

