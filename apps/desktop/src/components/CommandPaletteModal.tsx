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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'board' | 'test' | 'issues' | 'assets') => void;
  onToggleEnv: () => void;
  onTakeSnapshot: () => void;
  onTimeMachine: () => void;
  onSwitchLang: () => void;
  onCleanStorage: () => void;
  onOpenDoctor: () => void;
  onOpenConflictDoctor: () => void;
  onOpenSettings: () => void;
  onOpenLogs?: () => void;
  isEnvRunning: boolean;
}

interface CommandItem {
  id: string;
  group: 'groupNavigation' | 'groupActions' | 'groupTools';
  titleKey: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onToggleEnv,
  onTakeSnapshot,
  onTimeMachine,
  onSwitchLang,
  onCleanStorage,
  onOpenDoctor,
  onOpenConflictDoctor,
  onOpenSettings,
  onOpenLogs,
  isEnvRunning,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-board',
      group: 'groupNavigation',
      titleKey: 'modals.commandPalette.navBoard',
      icon: <Kanban size={15} className="text-emerald-400" />,
      action: () => onNavigateTab('board'),
    },
    {
      id: 'nav-test',
      group: 'groupNavigation',
      titleKey: 'modals.commandPalette.navTest',
      icon: <FlaskConical size={15} className="text-amber-400" />,
      action: () => onNavigateTab('test'),
    },
    {
      id: 'nav-issues',
      group: 'groupNavigation',
      titleKey: 'modals.commandPalette.navIssues',
      icon: <Bug size={15} className="text-rose-400" />,
      action: () => onNavigateTab('issues'),
    },
    {
      id: 'nav-assets',
      group: 'groupNavigation',
      titleKey: 'modals.commandPalette.navAssets',
      icon: <BookOpen size={15} className="text-blue-400" />,
      action: () => onNavigateTab('assets'),
    },

    // Actions
    {
      id: 'act-toggle-env',
      group: 'groupActions',
      titleKey: 'modals.commandPalette.actToggleEnv',
      icon: isEnvRunning ? (
        <Square size={15} className="text-rose-400" />
      ) : (
        <Play size={15} className="text-emerald-400" />
      ),
      action: onToggleEnv,
    },
    {
      id: 'act-snapshot',
      group: 'groupActions',
      titleKey: 'modals.commandPalette.actSnapshot',
      icon: <Camera size={15} className="text-slate-300" />,
      action: onTakeSnapshot,
    },
    {
      id: 'act-time-machine',
      group: 'groupActions',
      titleKey: 'modals.commandPalette.actTimeMachine',
      icon: <RotateCcw size={15} className="text-amber-300" />,
      action: onTimeMachine,
    },
    {
      id: 'act-switch-lang',
      group: 'groupActions',
      titleKey: 'modals.commandPalette.actSwitchLang',
      icon: <Languages size={15} className="text-cyan-400" />,
      action: onSwitchLang,
    },
    {
      id: 'act-clean-storage',
      group: 'groupActions',
      titleKey: 'modals.commandPalette.actCleanStorage',
      icon: <Trash2 size={15} className="text-rose-400" />,
      action: onCleanStorage,
    },

    // Tools
    {
      id: 'tool-doctor',
      group: 'groupTools',
      titleKey: 'modals.commandPalette.toolDoctor',
      icon: <Stethoscope size={15} className="text-emerald-400" />,
      action: onOpenDoctor,
    },
    {
      id: 'tool-conflict',
      group: 'groupTools',
      titleKey: 'modals.commandPalette.toolConflict',
      icon: <Radio size={15} className="text-amber-400" />,
      action: onOpenConflictDoctor,
    },
    {
      id: 'tool-settings',
      group: 'groupTools',
      titleKey: 'modals.commandPalette.toolSettings',
      icon: <Settings size={15} className="text-slate-400" />,
      action: onOpenSettings,
    },
    {
      id: 'tool-logs',
      group: 'groupTools',
      titleKey: 'modals.commandPalette.toolLogs',
      icon: <Terminal size={15} className="text-emerald-400" />,
      action: onOpenLogs || (() => {}),
    },
  ];

  const filtered = commands.filter((c) => {
    const text = t(c.titleKey).toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-24 p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#273247] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#222a3a]">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('modals.commandPalette.placeholder')}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <span className="text-[10px] bg-[#1e2535] border border-[#2c374d] text-slate-400 px-1.5 py-0.5 rounded font-mono">
            ESC
          </span>
        </div>

        {/* Command List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
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
                  <div className="flex items-center gap-2.5">
                    <span className="p-1 rounded bg-[#0d1017] border border-[#232b3b]">
                      {cmd.icon}
                    </span>
                    <span>{t(cmd.titleKey)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <span>{t(`modals.commandPalette.${cmd.group}`)}</span>
                    <ArrowRight size={11} className={isSelected ? 'text-emerald-400' : 'text-slate-600'} />
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              {t('modals.commandPalette.noResults')}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#1e2637] bg-[#0f121a] text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>↑↓ 切换 · Enter 执行 · ESC 关闭</span>
          <span className="text-slate-400">DevOS Command Palette</span>
        </div>
      </div>
    </div>
  );
};
