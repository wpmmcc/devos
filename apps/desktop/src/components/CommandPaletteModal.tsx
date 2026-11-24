import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Kanban,
  FlaskConical,
  Bug,
  BookOpen,
  Play,
  Square,
  Camera,
  RotateCcw,
  Languages,
  Trash2,
  Stethoscope,
  Radio,
  Settings,
  Terminal,
  X,
  ArrowRight,
  Bot,
  FolderGit2,
  HelpCircle,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bridge } from '../services/tauriBridge';
import { DevosProject, SearchResult } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject?: DevosProject | null;
  onNavigateTab: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  onSelectProject?: (path: string) => void;
  onToggleEnv: () => void;
  onRebuildEnv?: () => void;
  onOpenTerminal?: () => void;
  onTakeSnapshot: () => void;
  onTimeMachine: () => void;
  onSwitchLang: () => void;
  onCleanStorage: () => void;
  onOpenDoctor: () => void;
  onOpenConflictDoctor: () => void;
  onOpenAgentConnect?: () => void;
  onOpenSettings: () => void;
  onOpenLogs?: () => void;
  onOpenTrash?: () => void;
  isEnvRunning: boolean;
}

interface CommandItem {
  id: string;
  category: 'navigation' | 'action' | 'tool' | 'card' | 'issue' | 'project' | 'decision';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  onNavigateTab,
  onSelectProject,
  onToggleEnv,
  onRebuildEnv,
  onOpenTerminal,
  onTakeSnapshot,
  onTimeMachine,
  onSwitchLang,
  onCleanStorage,
  onOpenDoctor,
  onOpenConflictDoctor,
  onOpenAgentConnect,
  onOpenSettings,
  onOpenLogs,
  onOpenTrash,
  isEnvRunning,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-board',
      category: 'navigation',
      title: t('modals.commandPalette.navBoard'),
      subtitle: '看板任务与需求对齐',
      icon: <Kanban size={15} className="text-emerald-400" />,
      action: () => onNavigateTab('board'),
    },
    {
      id: 'nav-test',
      category: 'navigation',
      title: t('modals.commandPalette.navTest'),
      subtitle: '容器化测试与 RunManifest 预览',
      icon: <FlaskConical size={15} className="text-amber-400" />,
      action: () => onNavigateTab('test'),
    },
    {
      id: 'nav-issues',
      category: 'navigation',
      title: t('modals.commandPalette.navIssues'),
      subtitle: '缺陷管理与白盒复验闭环',
      icon: <Bug size={15} className="text-rose-400" />,
      action: () => onNavigateTab('issues'),
    },
    {
      id: 'nav-assets',
      category: 'navigation',
      title: t('modals.commandPalette.navAssets'),
      subtitle: '知识库、文档与磁盘空间',
      icon: <BookOpen size={15} className="text-blue-400" />,
      action: () => onNavigateTab('assets'),
    },

    // Actions
    {
      id: 'act-toggle-env',
      category: 'action',
      title: t('modals.commandPalette.actToggleEnv'),
      subtitle: isEnvRunning ? '停止当前容器环境' : '启动容器隔离沙盒',
      icon: isEnvRunning ? (
        <Square size={15} className="text-rose-400" />
      ) : (
        <Play size={15} className="text-emerald-400" />
      ),
      action: onToggleEnv,
    },
    {
      id: 'act-rebuild-env',
      category: 'action',
      title: '重建容器环境 (Rebuild Environment)',
      subtitle: '重新构建容器镜像并热重启',
      icon: <Wrench size={15} className="text-emerald-400" />,
      action: () => onRebuildEnv?.(),
    },
    {
      id: 'act-open-terminal',
      category: 'action',
      title: '打开容器终端 (Open Terminal)',
      subtitle: '交互式登录容器内 CLI Shell',
      icon: <Terminal size={15} className="text-cyan-400" />,
      action: () => onOpenTerminal?.(),
    },
    {
      id: 'act-snapshot',
      category: 'action',
      title: t('modals.commandPalette.actSnapshot'),
      subtitle: '创建环境快照包',
      icon: <Camera size={15} className="text-slate-300" />,
      action: onTakeSnapshot,
    },
    {
      id: 'act-time-machine',
      category: 'action',
      title: t('modals.commandPalette.actTimeMachine'),
      subtitle: '查看代码快照与时光机还原',
      icon: <RotateCcw size={15} className="text-amber-300" />,
      action: onTimeMachine,
    },
    {
      id: 'act-clean-storage',
      category: 'action',
      title: t('modals.commandPalette.actCleanStorage'),
      subtitle: '清理过期构建产物与 Docker 缓存',
      icon: <Trash2 size={15} className="text-rose-400" />,
      action: onCleanStorage,
    },
    {
      id: 'act-trash-view',
      category: 'action',
      title: '项目回收站 (Project Trash)',
      subtitle: '查看与恢复已移除的项目',
      icon: <Trash2 size={15} className="text-purple-400" />,
      action: () => onOpenTrash?.(),
    },

    // Tools
    {
      id: 'tool-agent-connect',
      category: 'tool',
      title: t('modals.commandPalette.toolAgentConnect'),
      subtitle: '配置 Claude Code / Cursor / Windsurf MCP 协议',
      icon: <Bot size={15} className="text-cyan-400" />,
      action: () => onOpenAgentConnect?.(),
    },
    {
      id: 'tool-doctor',
      category: 'tool',
      title: t('modals.commandPalette.toolDoctor'),
      subtitle: '环境驱动与依赖诊断修复',
      icon: <Stethoscope size={15} className="text-emerald-400" />,
      action: onOpenDoctor,
    },
    {
      id: 'tool-conflict',
      category: 'tool',
      title: t('modals.commandPalette.toolConflict'),
      subtitle: '本地端口冲突占用检测与调优',
      icon: <Radio size={15} className="text-amber-400" />,
      action: onOpenConflictDoctor,
    },
    {
      id: 'tool-settings',
      category: 'tool',
      title: t('modals.commandPalette.toolSettings'),
      subtitle: '网络镜像加速与全局偏好设置',
      icon: <Settings size={15} className="text-slate-400" />,
      action: onOpenSettings,
    },
    {
      id: 'tool-logs',
      category: 'tool',
      title: t('modals.commandPalette.toolLogs'),
      subtitle: '全量日志查看器与容器输出',
      icon: <Terminal size={15} className="text-emerald-400" />,
      action: onOpenLogs || (() => {}),
    },
    {
      id: 'act-switch-lang',
      category: 'action',
      title: t('modals.commandPalette.actSwitchLang'),
      subtitle: '切换界面语言 (中文 / English)',
      icon: <Languages size={15} className="text-cyan-400" />,
      action: onSwitchLang,
    },
  ];

  // Fetch SQLite full-text search results on query change
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setDbResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await Bridge.searchGlobal(q, currentProject?.slug);
        if (res.ok && res.data) {
          setDbResults(res.data);
        }
      } catch (err) {
        console.error('searchGlobal error:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, currentProject]);

  // Combine static commands and SQLite search results
  const qLower = query.trim().toLowerCase();
  const filteredBase = baseCommands.filter((c) => {
    if (!qLower) return true;
    return (
      c.title.toLowerCase().includes(qLower) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(qLower))
    );
  });

  const convertedDbItems: CommandItem[] = dbResults
    .filter((r) => r.category !== 'action') // actions are already covered
    .map((r) => {
      let icon = <Kanban size={15} className="text-emerald-400" />;
      let action = () => {};

      if (r.category === 'project') {
        icon = <FolderGit2 size={15} className="text-purple-400" />;
        action = () => onSelectProject?.(r.id);
      } else if (r.category === 'issue') {
        icon = <Bug size={15} className="text-rose-400" />;
        action = () => onNavigateTab('issues');
      } else if (r.category === 'decision') {
        icon = <HelpCircle size={15} className="text-amber-400" />;
        action = () => {};
      } else {
        icon = <Kanban size={15} className="text-emerald-400" />;
        action = () => onNavigateTab('board');
      }

      return {
        id: `db-${r.category}-${r.id}`,
        category: r.category as any,
        title: r.title,
        subtitle: r.subtitle,
        icon,
        action,
      };
    });

  const allItems: CommandItem[] = [...convertedDbItems, ...filteredBase];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDbResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(allItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(allItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#273247] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#222a3a]">
          <Search size={18} className="text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="搜索任务、Issue、项目、决策或快捷指令 (Cmd+K)..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <span className="text-[10px] bg-[#1e2535] border border-[#2c374d] text-slate-400 px-1.5 py-0.5 rounded font-mono">
            ESC
          </span>
        </div>

        {/* Command List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {allItems.length > 0 ? (
            allItems.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition select-none text-xs ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                      : 'text-slate-300 hover:bg-[#1b2130]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="p-1.5 rounded-lg bg-[#0d1017] border border-[#232b3b] shrink-0">
                      {cmd.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{cmd.title}</div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-slate-500 truncate">{cmd.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono shrink-0 ml-2">
                    <span className="uppercase px-1.5 py-0.5 rounded bg-[#10141d] border border-[#222b3b]">
                      {cmd.category}
                    </span>
                    <ArrowRight size={11} className={isSelected ? 'text-emerald-400' : 'text-slate-600'} />
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              未找到与 "{query}" 匹配的项目、任务或指令
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#1e2637] bg-[#0f121a] text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>↑↓ 切换 · Enter 确认执行 · ESC 关闭</span>
          <span className="text-slate-400">DevOS 全局智能检索</span>
        </div>
      </div>
    </div>
  );
};

