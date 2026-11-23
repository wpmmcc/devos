import React, { useState } from 'react';
import { Play, Square, Camera, TerminalSquare, Globe, Cpu } from 'lucide-react';
import { DevosProject } from '../types';
import { Bridge } from '../services/tauriBridge';

interface TopBarProps {
  project: DevosProject | null;
  activeTab: 'board' | 'test' | 'issues' | 'assets';
  onTabChange: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  openIssuesCount: number;
  testingCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  activeTab,
  onTabChange,
  openIssuesCount,
  testingCount,
}) => {
  const [isRunning, setIsRunning] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const handleToggleEnv = async () => {
    if (!project || isBusy) return;
    setIsBusy(true);
    if (isRunning) {
      const res = await Bridge.stopEnv('.', 'auto');
      if (res.ok) {
        setIsRunning(false);
      } else if (res.error) {
        alert(`无法停止环境: ${res.error.plain_message || res.error.message}`);
      }
    } else {
      const res = await Bridge.startEnv('.', 'auto');
      if (res.ok) {
        setIsRunning(true);
      } else if (res.error) {
        alert(`启动环境失败: ${res.error.plain_message || res.error.message}`);
      }
    }
    setIsBusy(false);
  };

  const handleSnapshot = async () => {
    if (!project) return;
    const name = window.prompt('请输入快照名称（如 baseline_v1）：', '');
    if (name === null) return;
    const res = await Bridge.createSnapshot('.', name);
    if (res.ok) {
      alert(`已成功创建数据库与环境快照：${res.data}`);
    } else {
      alert(`创建快照失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  if (!project) {
    return (
      <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center px-6">
        <span className="text-xs text-slate-500">请选择或新建一个项目以开始</span>
      </header>
    );
  }

  return (
    <header className="h-[52px] bg-[#12151d] border-b border-[#1e2330] flex items-center justify-between px-5 shrink-0">
      {/* Left Project Info & Mode */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">{project.name}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
          本地开发态 ({project.mode})
        </span>
      </div>

      {/* Center Nav Tabs (4 Core Views) */}
      <div className="flex items-center bg-[#181c27] p-1 rounded-lg border border-[#232938]">
        <button
          onClick={() => onTabChange('board')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'board'
              ? 'bg-[#22c55e] text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          看板与进度
        </button>

        <button
          onClick={() => onTabChange('test')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
            activeTab === 'test'
              ? 'bg-[#22c55e] text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>测试与预览</span>
          {testingCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'test' ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-500 text-slate-950'}`}>
              {testingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('issues')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
            activeTab === 'issues'
              ? 'bg-[#22c55e] text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Issue 反馈</span>
          {openIssuesCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'issues' ? 'bg-slate-900 text-rose-400' : 'bg-rose-500 text-white'}`}>
              {openIssuesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('assets')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition ${
            activeTab === 'assets'
              ? 'bg-[#22c55e] text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          项目资产与标准
        </button>
      </div>

      {/* Right Environment Status & Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Environment Status Light */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#181c27] border border-[#232938] rounded-md text-[11px] text-slate-300">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Web 容器运行中</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-slate-400">
            <Cpu size={12} className="text-blue-400" />
            <span>脚本就绪</span>
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
            <span>处理中...</span>
          ) : isRunning ? (
            <>
              <Square size={12} />
              <span>停止环境</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>启动环境</span>
            </>
          )}
        </button>

        {/* Take Snapshot */}
        <button
          onClick={handleSnapshot}
          className="flex items-center gap-1 px-2.5 py-1.2 rounded-md text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-slate-300 transition border border-[#2c3346]"
          title="保存当前可用状态"
        >
          <Camera size={13} />
          <span>保存快照</span>
        </button>

        {/* Open in Agent */}
        <button
          onClick={() => alert(`可在外部 Agent 工具（Claude Code / Droid / WorkBuddy 等）中执行:\n\ncd ${project.slug}\n devos brief`)}
          className="flex items-center gap-1 px-2.5 py-1.2 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold transition"
        >
          <TerminalSquare size={13} />
          <span>在 Agent 中开始</span>
        </button>
      </div>
    </header>
  );
};
