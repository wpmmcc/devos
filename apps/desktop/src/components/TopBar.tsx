import React from 'react';
import {
  Cpu,
  Search,
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
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  activeTab,
  onTabChange,
  openIssuesCount,
  testingCount,
  isEnvRunning = true,
  onOpenCommandPalette,
}) => {
  const { t } = useTranslation();

  if (!project) {
    return (
      <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center px-6">
        <span className="text-xs text-slate-500">{t('topbar.selectProject')}</span>
      </header>
    );
  }

  return (
    <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center justify-between px-3 sm:px-4 shrink-0 select-none whitespace-nowrap overflow-hidden">
      {/* Left Project Info & Mode */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
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

      {/* Center Nav Tabs (4 Core Views with tooltips) */}
      <div className="flex items-center bg-[#181c27] p-1 rounded-lg border border-[#232938] shrink-0 mx-1">
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

      {/* Right Minimal Environment Status & Quick Command Palette */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Environment Status Badge */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 bg-[#181c27] border border-[#232938] rounded-md text-[11px] text-slate-300"
          title={
            isEnvRunning
              ? '本地容器运行正常: 端口已就绪，网络通道畅通'
              : '本地开发容器已安全暂停'
          }
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
          <div className="hidden sm:flex items-center gap-1 text-slate-400" title="脚本执行引擎就绪">
            <Cpu size={12} className="text-blue-400" />
            <span>{t('topbar.scriptReady')}</span>
          </div>
        </div>

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
