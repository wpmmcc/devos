import React from 'react';
import { Plus, Stethoscope, FolderGit2 } from 'lucide-react';
import { DevosProject, RecentProjectDto } from '../types';

interface SidebarProps {
  currentProject: DevosProject | null;
  recentProjects: RecentProjectDto[];
  onSelectProjectByPath: (path: string) => void;
  onOpenNewProject: () => void;
  onOpenDoctor: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  recentProjects,
  onSelectProjectByPath,
  onOpenNewProject,
  onOpenDoctor,
}) => {
  return (
    <aside className="w-[220px] bg-[#12151d] border-r border-[#1e2330] flex flex-col justify-between shrink-0 h-screen">
      {/* Brand Header */}
      <div>
        <div className="h-[52px] flex items-center px-4 border-b border-[#1e2330] gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
            D
          </div>
          <span className="font-semibold text-slate-100 tracking-wide text-sm">DevOS</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-auto">v0.1</span>
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
              const isSelected = currentProject?.slug === p.name || currentProject?.name === p.name;
              return (
                <div
                  key={p.path}
                  onClick={() => onSelectProjectByPath(p.path)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition ${
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
                  <span className="text-[9px] text-slate-500 uppercase font-mono">{p.project_type}</span>
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

      {/* Bottom Utility Tools */}
      <div className="p-3 border-t border-[#1e2330] space-y-1">
        <button
          onClick={onOpenDoctor}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-[#1a1f2c] rounded-lg transition"
        >
          <Stethoscope size={14} className="text-emerald-400" />
          <span>环境体检</span>
        </button>

        <div className="px-2.5 py-2 flex items-center justify-between text-[11px] text-slate-400 bg-[#161a24] rounded-lg border border-[#1e2330]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Agent 插件</span>
          </span>
          <span className="text-emerald-400 font-medium">就绪</span>
        </div>
      </div>
    </aside>
  );
};

