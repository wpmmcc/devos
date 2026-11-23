import React from 'react';
import {
  Plus,
  Stethoscope,
  FolderGit2,
  Kanban,
  FlaskConical,
  Bug,
  BookOpen,
  Bot,
  Radio,
  Trash2,
} from 'lucide-react';
import { DevosProject, RecentProjectDto } from '../types';

interface SidebarProps {
  currentProject: DevosProject | null;
  recentProjects: RecentProjectDto[];
  activeTab: 'board' | 'test' | 'issues' | 'assets';
  onTabChange: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  openIssuesCount: number;
  testingCount: number;
  onSelectProjectByPath: (path: string) => void;
  onOpenNewProject: () => void;
  onOpenDoctor: () => void;
  onOpenConflictDoctor?: () => void;
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
  onOpenDoctor,
  onOpenConflictDoctor,
  runningProjectsCount,
  onStopAllEnvironments,
}) => {
  return (
    <aside className="w-[220px] bg-[#12151d] border-r border-[#1e2330] flex flex-col justify-between shrink-0 h-screen select-none">
      {/* Brand Header */}
      <div>
        <div className="h-[52px] flex items-center px-4 border-b border-[#1e2330] gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
            D
          </div>
          <span className="font-semibold text-slate-100 tracking-wide text-sm">DevOS</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-auto">
            v0.2
          </span>
        </div>

        {/* Project Section */}
        <div className="p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2 mb-2 font-medium">
            <span>我的项目</span>
            <button
              onClick={onOpenNewProject}
              className="p-1 hover:text-emerald-400 hover:bg-[#1a1f2c] rounded transition text-slate-400"
              title="新建项目"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {recentProjects.map((p) => {
              const isSelected =
                currentProject?.slug === p.name ||
                currentProject?.name === p.name ||
                currentProject?.slug === p.path ||
                currentProject?.name === p.path;

              return (
                <div key={p.path} className="space-y-1">
                  <div
                    onClick={() => onSelectProjectByPath(p.path)}
                    className={`w-full group flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-slate-100 shadow-sm'
                        : 'hover:bg-[#181c27] text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="truncate flex-1 text-left">{p.name}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-mono mr-1">
                      {p.project_type}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ok = window.confirm(
                          `是否将项目「${p.name}」移入 DevOS 回收站归档？\n（数据将安全归档在 ~/.devos/trash，绝不物理抹除您的源码心血）`
                        );
                        if (ok) {
                          alert(`项目「${p.name}」已安全移入回收站归档。`);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded text-slate-500 transition"
                      title="安全移入回收站"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* 4 Expanded Sub-entries for Active Project */}
                  {isSelected && (
                    <div className="pl-4 pr-1 py-1 space-y-0.5">
                      <button
                        onClick={() => onTabChange('board')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                          activeTab === 'board'
                            ? 'bg-[#1e2433] text-emerald-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                        }`}
                      >
                        <Kanban size={12} />
                        <span>看板与进度</span>
                      </button>

                      <button
                        onClick={() => onTabChange('test')}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                          activeTab === 'test'
                            ? 'bg-[#1e2433] text-emerald-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <FlaskConical size={12} />
                          <span>测试与预览台</span>
                        </span>
                        {testingCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400">
                            {testingCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => onTabChange('issues')}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                          activeTab === 'issues'
                            ? 'bg-[#1e2433] text-emerald-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Bug size={12} />
                          <span>Issue 反馈中心</span>
                        </span>
                        {openIssuesCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                            {openIssuesCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => onTabChange('assets')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
                          activeTab === 'assets'
                            ? 'bg-[#1e2433] text-emerald-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                        }`}
                      >
                        <BookOpen size={12} />
                        <span>项目资产与真源</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {recentProjects.length === 0 && (
              <div className="px-2 py-4 text-xs text-slate-500 text-center">
                暂无打开的项目
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Running Environments Resource Capsule */}
      <div className="px-3 pt-3 border-t border-[#1e2330]">
        <div className="px-2.5 py-1.5 bg-[#161a25] rounded-lg border border-[#232938] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                (runningProjectsCount || 0) > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-[11px]">运行中: {runningProjectsCount ?? (currentProject ? 1 : 0)} 个</span>
          </div>
          {(runningProjectsCount || 0) > 0 && onStopAllEnvironments && (
            <button
              onClick={onStopAllEnvironments}
              className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 transition font-medium"
              title="一键停止所有运行中的 Docker 容器，释放电脑算力"
            >
              停止全部
            </button>
          )}
        </div>
      </div>

      {/* Bottom Utility Tools */}
      <div className="p-3 border-t border-[#1e2330] space-y-1">
        <button
          onClick={() => onTabChange('assets')}
          className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
        >
          <span className="flex items-center gap-2">
            <Bot size={14} className="text-cyan-400" />
            <span>连接 Agent 工具</span>
          </span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
            MCP
          </span>
        </button>

        <button
          onClick={onOpenDoctor}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
        >
          <Stethoscope size={14} className="text-emerald-400" />
          <span>环境体检 (Doctor)</span>
        </button>

        {onOpenConflictDoctor && (
          <button
            onClick={onOpenConflictDoctor}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
          >
            <Radio size={14} className="text-amber-400" />
            <span>端口冲突诊断 (Conflict)</span>
          </button>
        )}
      </div>
    </aside>
  );
};

