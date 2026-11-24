import React from 'react';
import {
  Plus,
  Stethoscope,
  Kanban,
  FlaskConical,
  Bug,
  BookOpen,
  Bot,
  Radio,
  Trash2,
  Settings,
  FolderOpen,
  Terminal,
  Code2,
  Play,
  Square,
  RotateCw,
  RotateCcw,
  Camera,
  Languages,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DevosProject, RecentProjectDto } from '../types';
import { Bridge } from '../services/tauriBridge';
import { switchLanguage } from '../i18n';

interface SidebarProps {
  currentProject: DevosProject | null;
  recentProjects: RecentProjectDto[];
  activeTab: 'board' | 'test' | 'issues' | 'assets';
  onTabChange: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  openIssuesCount: number;
  testingCount: number;
  onSelectProjectByPath: (path: string) => void;
  onOpenNewProject: () => void;
  onOpenTrashModal?: (project: RecentProjectDto) => void;
  onOpenTrashViewer?: () => void;
  onOpenEditor?: (path: string) => void;
  // Project-level runtime controls:
  isEnvRunning?: boolean;
  isEnvBusy?: boolean;
  onToggleEnv?: () => void;
  onRestartEnv?: () => void;
  onRebuildEnv?: () => void;
  onOpenContainerTerminal?: () => void;
  onTakeSnapshot?: () => void;
  onOpenTimeMachine?: () => void;
  onOpenLogs?: () => void;
  // Application-level tools:
  onOpenDoctor: () => void;
  onOpenConflictDoctor?: () => void;
  onOpenAgentConnect?: () => void;
  onOpenSettings?: () => void;
  runningProjectsCount?: number;
  onStopAllEnvironments?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  recentProjects,
  activeTab,
  onTabChange,
  openIssuesCount,
  testingCount,
  onSelectProjectByPath,
  onOpenNewProject,
  onOpenTrashModal,
  onOpenTrashViewer,
  onOpenEditor,
  isEnvRunning = true,
  isEnvBusy = false,
  onToggleEnv,
  onRestartEnv,
  onRebuildEnv,
  onOpenContainerTerminal,
  onTakeSnapshot,
  onOpenTimeMachine,
  onOpenLogs,
  onOpenDoctor,
  onOpenConflictDoctor,
  onOpenAgentConnect,
  onOpenSettings,
  runningProjectsCount,
  onStopAllEnvironments,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <aside className="w-[260px] bg-[#12151d] border-r border-[#1e2330] flex flex-col shrink-0 h-screen select-none">
      {/* Brand Header */}
      <div className="h-[52px] shrink-0 flex items-center px-4 border-b border-[#1e2330] gap-2.5">
        <div
          className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm"
          title="DevOS - AI 原生容器化开发与测试操作系统"
        >
          D
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100 tracking-wide text-sm">DevOS</span>
          <span className="text-[9px] text-slate-500">{t('sidebar.brandSubtitle')}</span>
        </div>
      </div>

      {/* Projects List & Project-Level Navigation (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {/* Projects Section Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
          <span className="font-semibold text-slate-300">{t('sidebar.myProjects')}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onOpenNewProject}
              className="p-1 hover:text-emerald-400 hover:bg-[#1a1f2c] rounded transition text-slate-400"
              title="新建或导入项目: 支持 Web 应用、脚本任务与自定义容器"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Project Items */}
        <div className="space-y-2">
          {recentProjects.map((p) => {
            const isSelected =
              currentProject?.slug === p.name ||
              currentProject?.name === p.name ||
              currentProject?.slug === p.path ||
              currentProject?.name === p.path;

            return (
              <div
                key={p.path}
                onClick={() => onSelectProjectByPath(p.path)}
                className={`p-2.5 rounded-lg cursor-pointer transition border ${
                  isSelected
                    ? 'bg-[#151a26] border-emerald-500/30 text-slate-100 shadow-sm'
                    : 'hover:bg-[#161a24] text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                {/* Line 1: Full Project Name (No Truncation) + Status Dot + Type Tag */}
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                        isSelected && isEnvRunning
                          ? 'bg-emerald-400 animate-pulse'
                          : isSelected
                          ? 'bg-amber-400'
                          : 'bg-slate-600'
                      }`}
                      title={
                        isSelected && isEnvRunning
                          ? '环境状态: 本地容器正在运行'
                          : isSelected
                          ? '环境状态: 容器已停止'
                          : '项目就绪'
                      }
                    />
                    <span
                      className="font-semibold text-xs text-slate-100 break-all leading-tight"
                      title={`项目: ${p.name}\n路径: ${p.path}`}
                    >
                      {p.name}
                    </span>
                  </div>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2433] text-emerald-400 font-mono shrink-0 uppercase border border-emerald-500/20"
                    title={`架构模式: ${p.project_type}`}
                  >
                    {p.project_type}
                  </span>
                </div>

                {/* Line 2 (Placed BELOW project name): Project Quick Action Shortcuts */}
                <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-[#1e2330]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      Bridge.openInFinder(p.path);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181c27] hover:bg-[#222838] hover:text-emerald-400 text-slate-400 text-[10px] transition border border-[#232938]"
                    title="在访达中显示: 打开 macOS Finder 显示项目源码"
                  >
                    <FolderOpen size={10} />
                    <span>{t('sidebar.finder')}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      Bridge.openInTerminal(p.path);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181c27] hover:bg-[#222838] hover:text-cyan-400 text-slate-400 text-[10px] transition border border-[#232938]"
                    title="在终端中打开: 打开 macOS Terminal 并进入此项目目录"
                  >
                    <Terminal size={10} />
                    <span>{t('sidebar.terminal')}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenEditor) {
                        onOpenEditor(p.path);
                      } else {
                        Bridge.openInEditor(p.path, 'auto');
                      }
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181c27] hover:bg-[#222838] hover:text-indigo-400 text-slate-400 text-[10px] transition border border-[#232938]"
                    title="在编辑器打开: 使用 Cursor 或 VS Code 打开代码"
                  >
                    <Code2 size={10} />
                    <span>{t('sidebar.editor')}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenTrashModal) {
                        onOpenTrashModal(p);
                      }
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181c27] hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 text-[10px] transition border border-[#232938] ml-auto"
                    title="移除项目: 将项目安全移入 DevOS 回收站归档"
                  >
                    <Trash2 size={10} />
                    <span>{t('sidebar.trash')}</span>
                  </button>
                </div>

                {/* Sub-Tree: Project-Level Menus (Views + Runtime Actions) when Selected */}
                {isSelected && (
                  <div className="mt-2.5 pt-2 border-t border-[#1e2330] space-y-2.5">
                    {/* 1. Project-Level Views */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1">
                        {t('sidebar.projectViews')}
                      </div>
                      <div className="space-y-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTabChange('board');
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                            activeTab === 'board'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                          }`}
                          title="任务看板: 研发任务泳道与 AI 自动推进"
                        >
                          <Kanban size={12} />
                          <span>{t('sidebar.board')}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTabChange('test');
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                            activeTab === 'test'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                          }`}
                          title="测试预览: 真机页面预览与后台脚本测试工作台"
                        >
                          <span className="flex items-center gap-2">
                            <FlaskConical size={12} />
                            <span>{t('sidebar.testPreview')}</span>
                          </span>
                          {testingCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 shrink-0">
                              {testingCount}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTabChange('issues');
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                            activeTab === 'issues'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                          }`}
                          title="问题反馈: 缺陷清单与一键打包指令供 AI 修复"
                        >
                          <span className="flex items-center gap-2">
                            <Bug size={12} />
                            <span>{t('sidebar.issues')}</span>
                          </span>
                          {openIssuesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white shrink-0">
                              {openIssuesCount}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTabChange('assets');
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                            activeTab === 'assets'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                          }`}
                          title="规范资产: 业务需求、编码硬标准与运行清单"
                        >
                          <BookOpen size={12} />
                          <span>{t('sidebar.assets')}</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Project-Level Runtime & Operations */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1">
                        {t('sidebar.projectRuntime')}
                      </div>
                      <div className="space-y-1">
                        {/* Start/Stop & Restart Capsule */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleEnv?.();
                            }}
                            disabled={isEnvBusy}
                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium border transition ${
                              isEnvRunning
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            title={
                              isEnvRunning
                                ? '停止环境: 停止当前项目容器并释放端口与内存'
                                : '启动环境: 启动当前项目的本地开发容器'
                            }
                          >
                            {isEnvBusy ? (
                              <>
                                <Loader2 size={11} className="animate-spin text-cyan-400" />
                                <span className="text-cyan-300">
                                  {isEnvRunning ? t('sidebar.stoppingEnv') : t('sidebar.startingEnv')}
                                </span>
                              </>
                            ) : isEnvRunning ? (
                              <>
                                <Square size={11} />
                                <span>{t('sidebar.stopEnv')}</span>
                              </>
                            ) : (
                              <>
                                <Play size={11} />
                                <span>{t('sidebar.startEnv')}</span>
                              </>
                            )}
                          </button>

                          {isEnvRunning && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRestartEnv?.();
                                }}
                                disabled={isEnvBusy}
                                className="px-2 py-1 rounded bg-[#1e2330] hover:bg-[#282f42] text-slate-300 border border-[#2c3346] text-[11px] transition"
                                title="重启环境: 快速重新启动当前项目的本地开发容器"
                              >
                                <RotateCw
                                  size={11}
                                  className={isEnvBusy ? 'animate-spin text-cyan-400' : 'text-slate-400'}
                                />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRebuildEnv?.();
                                }}
                                disabled={isEnvBusy}
                                className="px-2 py-1 rounded bg-[#1e2330] hover:bg-[#282f42] text-amber-300 border border-[#2c3346] text-[11px] transition"
                                title="重新构建: 重新构建项目镜像并重启 (用于 Dockerfile 或配置修改生效)"
                              >
                                <RotateCcw
                                  size={11}
                                  className={isEnvBusy ? 'animate-spin text-cyan-400' : 'text-amber-400'}
                                />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenContainerTerminal?.();
                                }}
                                className="px-2 py-1 rounded bg-[#1e2330] hover:bg-[#282f42] text-emerald-300 border border-[#2c3346] text-[11px] transition"
                                title="容器终端: 打开系统终端连入容器内部 (Shell/SSH)"
                              >
                                <Terminal size={11} className="text-emerald-400" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Project Actions: Logs / Snapshot / TimeMachine */}
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLogs?.();
                            }}
                            className="flex items-center justify-center gap-1 py-1 rounded bg-[#181c27] hover:bg-[#222838] text-slate-300 text-[10px] font-medium transition border border-[#232938]"
                            title="运行日志: 打开实时日志监控抽屉"
                          >
                            <Terminal size={11} className="text-emerald-400" />
                            <span>{t('sidebar.logs')}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTakeSnapshot?.();
                            }}
                            className="flex items-center justify-center gap-1 py-1 rounded bg-[#181c27] hover:bg-[#222838] text-amber-300 text-[10px] font-medium transition border border-[#232938]"
                            title="环境快照: 记录当前环境状态与数据库用于排障对比"
                          >
                            <Camera size={11} className="text-amber-400" />
                            <span>{t('sidebar.snapshot')}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTimeMachine?.();
                            }}
                            className="flex items-center justify-center gap-1 py-1 rounded bg-[#181c27] hover:bg-[#222838] text-indigo-300 text-[10px] font-medium transition border border-[#232938]"
                            title="时光机: 查看并回滚 AI 生成的历史代码与检查点"
                          >
                            <RotateCcw size={11} className="text-indigo-400" />
                            <span>{t('sidebar.timeMachine')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {recentProjects.length === 0 && (
            <div className="px-2 py-4 text-xs text-slate-500 text-center">
              {t('sidebar.noProjects')}
            </div>
          )}
        </div>
      </div>

      {/* Running Environments Resource Capsule */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-t border-[#1e2330]">
        <div className="px-2.5 py-1.5 bg-[#161a25] rounded-lg border border-[#232938] flex items-center justify-between text-xs">
          <div
            className="flex items-center gap-1.5 text-slate-300"
            title="当前所有正在运行的容器环境总数"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                (runningProjectsCount || 0) > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-[11px]">
              {t('sidebar.runningCount', {
                count: runningProjectsCount ?? (currentProject ? 1 : 0),
              })}
            </span>
          </div>
          {(runningProjectsCount || 0) > 0 && onStopAllEnvironments && (
            <button
              onClick={onStopAllEnvironments}
              className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 transition font-medium"
              title="一键停止全部: 释放系统全部容器占用的算力与内存"
            >
              {t('sidebar.stopAll')}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Utility Tools (Application Level) */}
      <div className="shrink-0 p-3 pt-2 border-t border-[#1e2330] space-y-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1">
          {t('sidebar.appTools')}
        </div>

        {/* AI Agent Connect */}
        <button
          onClick={() => {
            if (onOpenAgentConnect) {
              onOpenAgentConnect();
            } else {
              onTabChange('assets');
            }
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
          title="AI Agent 连接中心: 配置与连接 Claude / Cursor / Antigravity / TRAE MCP"
        >
          <span className="flex items-center gap-2">
            <Bot size={13} className="text-cyan-400" />
            <span>{t('sidebar.connectAgents')}</span>
          </span>
          <span className="text-[9px] text-cyan-400 bg-cyan-950/40 px-1 py-0.5 rounded border border-cyan-800/40 font-mono">
            MCP
          </span>
        </button>

        {/* Preflight Doctor */}
        <button
          onClick={onOpenDoctor}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
          title="系统诊断 (Doctor): 检测 Docker Engine、DDEV 架构与网络就绪状态"
        >
          <Stethoscope size={13} className="text-emerald-400" />
          <span>{t('sidebar.preflightDoctor')}</span>
        </button>

        {/* Conflict Doctor */}
        {onOpenConflictDoctor && (
          <button
            onClick={onOpenConflictDoctor}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
            title="端口检测 (Conflict): 扫描本地 80/443 等端口占用并支持一键规避"
          >
            <Radio size={13} className="text-amber-400" />
            <span>{t('sidebar.conflictDoctor')}</span>
          </button>
        )}

        {/* Project Trash */}
        {onOpenTrashViewer && (
          <button
            onClick={onOpenTrashViewer}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
            title="项目回收站 (Project Trash): 查看已归档项目、一键安全恢复或彻底粉碎"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={13} className="text-rose-400" />
              <span>{t('sidebar.projectTrash')}</span>
            </span>
            <span className="text-[9px] text-rose-400 bg-rose-950/40 px-1 py-0.5 rounded border border-rose-800/40 font-mono">
              Trash
            </span>
          </button>
        )}

        {/* Settings */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
            title="偏好设置: 通用偏好、主题外观、国内网络加速配置"
          >
            <Settings size={13} className="text-slate-400" />
            <span>{t('sidebar.settings')}</span>
          </button>
        )}

        {/* Language Switch */}
        <button
          onClick={() => {
            const nextLang = i18n.language.startsWith('zh') ? 'en-US' : 'zh-CN';
            switchLanguage(nextLang);
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
          title="切换界面语言: 在中文与英文之间切换 (中 / EN)"
        >
          <span className="flex items-center gap-2">
            <Languages size={13} className="text-cyan-400" />
            <span>{t('sidebar.switchLang')}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-[#161a25] px-1.5 py-0.5 rounded border border-[#232938]">
            {i18n.language.startsWith('zh') ? '中文' : 'EN'}
          </span>
        </button>
      </div>
    </aside>
  );
};
