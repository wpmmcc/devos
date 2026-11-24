import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, X, Bot, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BoardView } from './components/BoardView';
import { TestPreviewView } from './components/TestPreviewView';
import { IssuesView } from './components/IssuesView';
import { AssetsView } from './components/AssetsView';
import { NewProjectModal } from './components/NewProjectModal';
import { PreflightDoctorModal } from './components/PreflightDoctorModal';
import { CreateIssueModal } from './components/CreateIssueModal';
import { ConflictDoctorModal } from './components/ConflictDoctorModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { SettingsModal } from './components/SettingsModal';
import { TimeMachineModal } from './components/TimeMachineModal';
import { LogViewerModal } from './components/LogViewerModal';
import { AgentConnectModal } from './components/AgentConnectModal';
import { SnapshotModal } from './components/SnapshotModal';
import { TrashConfirmModal } from './components/TrashConfirmModal';
import { TrashViewerModal } from './components/TrashViewerModal';
import { ToastContainer, ToastItem } from './components/ToastContainer';
import { switchLanguage } from './i18n';
import {
  BoardCard,
  BoardColumn,
  DecisionRequest,
  DevosProject,
  Issue,
  ProjectType,
  RecentProjectDto,
  RunManifest,
  ScriptContext,
} from './types';
import { Bridge } from './services/tauriBridge';

export const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentProjectPath, setCurrentProjectPath] = useState<string>('.');
  const currentProjectPathRef = useRef<string>('.');
  const [project, setProject] = useState<DevosProject | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProjectDto[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'test' | 'issues' | 'assets'>('board');
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [manifest, setManifest] = useState<RunManifest | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState<DecisionRequest[]>([]);

  // Modals state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [isConflictDoctorOpen, setIsConflictDoctorOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAgentConnectOpen, setIsAgentConnectOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isTrashViewerOpen, setIsTrashViewerOpen] = useState(false);
  const [projectToTrash, setProjectToTrash] = useState<RecentProjectDto | null>(null);
  const [issueModalData, setIssueModalData] = useState<any>(null);

  // Environment Runtime state
  const [isEnvRunning, setIsEnvRunning] = useState<boolean>(false);
  const [isEnvBusy, setIsEnvBusy] = useState<boolean>(false);

  const handleToggleEnv = async () => {
    if (!project || isEnvBusy) return;
    setIsEnvBusy(true);
    const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
    if (isEnvRunning) {
      addToast('info', t('toast.envStopping'));
      const res = await Bridge.stopEnv(targetPath, 'auto');
      if (res.ok) {
        setIsEnvRunning(false);
        addToast('info', t('toast.envStopped'));
      } else if (res.error) {
        addToast('error', res.error.plain_message || res.error.message);
      }
    } else {
      addToast('info', t('toast.envStarting'));
      const res = await Bridge.startEnv(targetPath, 'auto');
      if (res.ok) {
        setIsEnvRunning(true);
        addToast('success', t('toast.envStarted'));
      } else if (res.error) {
        addToast('error', res.error.plain_message || res.error.message);
      }
    }
    setIsEnvBusy(false);
  };

  const handleRestartEnv = async () => {
    if (!project || isEnvBusy) return;
    setIsEnvBusy(true);
    addToast('info', t('topbar.restartingEnv'));
    const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
    await Bridge.stopEnv(targetPath, 'auto');
    const res = await Bridge.startEnv(targetPath, 'auto');
    if (res.ok) {
      setIsEnvRunning(true);
      addToast('success', t('toast.envStarted'));
    } else if (res.error) {
      addToast('error', res.error.plain_message || res.error.message);
    }
    setIsEnvBusy(false);
  };

  const handleRebuildEnv = async () => {
    if (!project || isEnvBusy) return;
    setIsEnvBusy(true);
    addToast('info', '正在重新构建容器镜像并重启，请稍候...');
    const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
    const res = await Bridge.rebuildEnv(targetPath, 'auto');
    if (res.ok) {
      setIsEnvRunning(true);
      addToast('success', '容器镜像重新构建并启动成功！');
    } else if (res.error) {
      addToast('error', `重新构建失败: ${res.error.plain_message || res.error.message}`);
    }
    setIsEnvBusy(false);
  };

  const handleOpenContainerTerminal = async () => {
    if (!project) return;
    const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
    const res = await Bridge.openContainerTerminal(targetPath, 'auto');
    if (res.ok) {
      addToast('success', '已在系统独立终端窗口连入容器内部环境 (Shell)');
    } else if (res.error) {
      addToast('error', `打开容器终端失败: ${res.error.plain_message || res.error.message}`);
    }
  };

  const refreshPendingDecisions = async () => {
    try {
      const target = currentProjectPathRef.current || '.';
      const res = await Bridge.listPendingDecisions(target);
      if (res.ok && res.data) {
        setPendingDecisions(res.data);
      } else {
        setPendingDecisions([]);
      }
    } catch (e) {
      console.error('Failed to list decisions', e);
    }
  };

  const handleResolveDecision = async (decisionId: string, optionId: string) => {
    const target = currentProjectPathRef.current || '.';
    const res = await Bridge.resolveUserDecision(target, decisionId, optionId);
    if (res.ok) {
      addToast('success', '已采纳决策方案！已同步通知 AI Agent 继续推进。');
      refreshPendingDecisions();
    } else {
      addToast('error', `提交决策失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  const handleCreateSnapshotConfirm = async (name: string) => {
    if (!project) return;
    const target = currentProjectPathRef.current || '.';
    const res = await Bridge.createSnapshot(target, name);
    if (res.ok) {
      addToast('success', t('topbar.snapshotSuccess', { id: res.data || name }));
    } else {
      addToast('error', `快照保存失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  const handleOpenEditor = async (path: string) => {
    const res = await Bridge.openInEditor(path, 'auto');
    if (res.ok) {
      const tool = res.data;
      if (tool === 'cursor') {
        addToast('success', '已在 Cursor 中打开项目源码');
      } else if (tool === 'code') {
        addToast('success', '已在 VS Code 中打开项目源码');
      } else if (tool === 'trae' || tool === 'windsurf') {
        addToast('success', `已在 ${tool} 中打开项目源码`);
      } else {
        addToast('info', '已在系统访达/默认工具中定位项目源码（提示：本机未安装 Cursor / VS Code，建议安装以获得最佳体验）');
      }
    } else {
      addToast('error', `打开编辑器失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  const handleConfirmTrash = async (p: RecentProjectDto) => {
    const res = await Bridge.trashProject(p.path);
    if (res.ok) {
      addToast(
        'success',
        `项目「${p.name}」已安全移入 DevOS 回收站归档。可点击左侧回收站图标随时查看或恢复。`
      );
      const recents = await loadRecentProjects();
      if (currentProjectPathRef.current === p.path) {
        if (recents.length > 0) {
          loadProjectData(recents[0].path);
        } else {
          setProject(null);
        }
      }
    } else {
      addToast('error', `移入回收站失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  // Toasts state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (
    type: 'success' | 'info' | 'warning' | 'error',
    message: string,
    actionText?: string,
    copyText?: string
  ) => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type,
      message,
      actionText,
      copyText,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  const loadRecentProjects = async () => {
    const res = await Bridge.getRecentProjects();
    if (res.ok && res.data) {
      setRecentProjects(res.data);
      return res.data;
    }
    return [];
  };

  const refreshEnvStatus = async (projPath?: string) => {
    const target = projPath || currentProjectPathRef.current || currentProjectPath || '.';
    try {
      const res = await Bridge.getEnvStatus(target, 'auto');
      if (res.ok && res.data) {
        setIsEnvRunning(res.data.running);
      }
    } catch {
      // ignore
    }
  };

  const loadProjectData = async (projPath: string) => {
    currentProjectPathRef.current = projPath;
    setCurrentProjectPath(projPath);
    const res = await Bridge.loadProject(projPath);
    if (res.ok && res.data) {
      setProject(res.data);
      refreshCards(projPath);
      refreshIssues(projPath);
      refreshManifest(projPath);
      refreshEnvStatus(projPath);
      refreshPendingDecisions();
      loadRecentProjects();
    }
  };

  const refreshCards = async (projPath?: string) => {
    const target = projPath || currentProjectPathRef.current || '.';
    const res = await Bridge.listCards(target);
    if (res.ok && res.data) {
      setCards(res.data);
    }
  };

  const refreshIssues = async (projPath?: string) => {
    const target = projPath || currentProjectPathRef.current || '.';
    const res = await Bridge.listIssues(target);
    if (res.ok && res.data) {
      setIssues(res.data);
    }
  };

  const refreshManifest = async (projPath?: string) => {
    const target = projPath || currentProjectPathRef.current || '.';
    const res = await Bridge.getRunManifest(target);
    if (res.ok && res.data) {
      setManifest(res.data);
    }
  };

  useEffect(() => {
    // 1. Initial load
    loadRecentProjects().then(async (recents) => {
      const initialPath = recents && recents.length > 0 ? recents[0].path : '.';
      await loadProjectData(initialPath);
    });

    // 2. Global shortcut Cmd/Ctrl + K & Escape to close modals
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsAgentConnectOpen(false);
        setIsDoctorOpen(false);
        setIsConflictDoctorOpen(false);
        setIsSettingsOpen(false);
        setIsTimeMachineOpen(false);
        setIsLogModalOpen(false);
        setIsNewProjectOpen(false);
        setIsCreateIssueOpen(false);
        setIsSnapshotModalOpen(false);
        setIsTrashModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 3. Setup real-time event listeners from Tauri Core
    let unlistenBoard: any;
    let unlistenIssues: any;
    let unlistenProject: any;

    Bridge.listenToEvent('devos://board-updated', () => {
      refreshCards(currentProjectPathRef.current);
    }).then((unlisten) => {
      unlistenBoard = unlisten;
    });

    Bridge.listenToEvent('devos://issues-updated', () => {
      refreshIssues(currentProjectPathRef.current);
      refreshCards(currentProjectPathRef.current);
    }).then((unlisten) => {
      unlistenIssues = unlisten;
    });

    Bridge.listenToEvent('devos://project-updated', () => {
      loadProjectData(currentProjectPathRef.current);
    }).then((unlisten) => {
      unlistenProject = unlisten;
    });

    // 4. Lightweight 3-second heartbeat sync for external AI changes
    const pollInterval = setInterval(() => {
      if (currentProjectPathRef.current && currentProjectPathRef.current !== '.') {
        refreshCards(currentProjectPathRef.current);
        refreshIssues(currentProjectPathRef.current);
        refreshPendingDecisions();
      }
    }, 3000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(pollInterval);
      if (typeof unlistenBoard === 'function') unlistenBoard();
      if (typeof unlistenIssues === 'function') unlistenIssues();
      if (typeof unlistenProject === 'function') unlistenProject();
    };
  }, [currentProjectPath]);

  const handleCreateProject = async (
    name: string,
    slug: string,
    type: ProjectType,
    description: string
  ) => {
    const res = await Bridge.initProject('.', slug, name, description, type);
    if (res.ok && res.data) {
      await loadRecentProjects();
      await loadProjectData(res.data.slug);
      addToast('success', t('common.success'));
    }
  };

  const handleCreateCard = async (title: string) => {
    if (!project) return;
    const res = await Bridge.createCard(currentProjectPath, title);
    if (res.ok) {
      refreshCards();
      addToast('success', t('toast.cardCreated', '新任务卡片已创建'));
    } else if (res.error) {
      alert(`${t('common.error')}: ${res.error.plain_message || res.error.message}`);
    }
  };

  const handleMoveCard = async (cardId: string, col: BoardColumn) => {
    if (!project) return;
    const res = await Bridge.moveCard(currentProjectPath, cardId, col, 'user');
    if (res.ok) {
      refreshCards();
      addToast('success', t('toast.cardMoved', { col: t(`board.${col}`) }));
    } else if (res.error) {
      alert(`${t('common.error')}: ${res.error.plain_message || res.error.message}`);
    }
  };

  const handleRetestIssue = async (issueId: string, passed: boolean, feedback: string) => {
    if (!project) return;
    const res = await Bridge.retestIssue(currentProjectPath, issueId, passed, feedback);
    if (res.ok) {
      refreshIssues();
      refreshCards();
      addToast('success', passed ? t('issues.retestPass') : t('issues.retestFail'));
    }
  };

  const handleRunScript = async (
    targetId: string,
    inputs: Record<string, any>
  ): Promise<ScriptContext | null> => {
    if (!project) return null;
    const res = await Bridge.executeScript(currentProjectPath, targetId, inputs);
    return res.ok && res.data ? res.data : null;
  };

  const handleSubmitIssue = async (
    title: string,
    description: string,
    expected: string,
    data: any
  ) => {
    if (!project) return;
    let res;
    if (data?.source_type === 'script_run') {
      res = await Bridge.createScriptIssue(
        currentProjectPath,
        title,
        description,
        expected,
        data.script
      );
    } else {
      res = await Bridge.createWebIssue(
        currentProjectPath,
        title,
        description,
        data?.url || 'https://invoice-helper.ddev.site',
        expected,
        data?.console_errors || [],
        data?.failed_requests || []
      );
    }

    if (res.ok) {
      refreshIssues();
      setActiveTab('issues');
      const issueId = res.data?.issue_id || 'ISS-001';
      const copyCmd = `请处理「${project.name}」(${project.project_id}) 的 ${issueId}: ${title}`;
      addToast(
        'info',
        t('toast.issueCreated', { id: issueId }),
        t('toast.copyInstruction'),
        copyCmd
      );
    } else if (res.error) {
      alert(`${t('common.error')}: ${res.error.plain_message || res.error.message}`);
    }
  };

  const openIssuesCount = issues.filter(
    (i) => i.status === 'open' || i.status === 'reopened' || i.status === 'ready_for_retest'
  ).length;
  const testingCount = cards.filter((c) => c.column === 'testing').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0d13]">
      {/* 260px Sidebar */}
      <Sidebar
        currentProject={project}
        recentProjects={recentProjects}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openIssuesCount={openIssuesCount}
        testingCount={testingCount}
        onSelectProjectByPath={(path) => loadProjectData(path)}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenTrashModal={(p) => {
          setProjectToTrash(p);
          setIsTrashModalOpen(true);
        }}
        onOpenTrashViewer={() => setIsTrashViewerOpen(true)}
        onOpenEditor={handleOpenEditor}
        isEnvRunning={isEnvRunning}
        isEnvBusy={isEnvBusy}
        onToggleEnv={handleToggleEnv}
        onRestartEnv={handleRestartEnv}
        onRebuildEnv={handleRebuildEnv}
        onOpenContainerTerminal={handleOpenContainerTerminal}
        onTakeSnapshot={() => setIsSnapshotModalOpen(true)}
        onOpenTimeMachine={() => setIsTimeMachineOpen(true)}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenDoctor={() => setIsDoctorOpen(true)}
        onOpenConflictDoctor={() => setIsConflictDoctorOpen(true)}
        onOpenAgentConnect={() => setIsAgentConnectOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        runningProjectsCount={isEnvRunning && project ? 1 : 0}
        onStopAllEnvironments={async () => {
          if (project) {
            const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
            await Bridge.stopEnv(targetPath, 'auto');
            setIsEnvRunning(false);
          }
          addToast('info', t('sidebar.stopAllSuccess'));
        }}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 52px Top Bar */}
        <TopBar
          project={project}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          openIssuesCount={openIssuesCount}
          testingCount={testingCount}
          isEnvRunning={isEnvRunning}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
          onRebuildEnv={handleRebuildEnv}
          onOpenTerminal={handleOpenContainerTerminal}
        />

        {/* Workspace Body */}
        {project ? (
          <>
            {/* Human-In-The-Loop Pending Decision Notification Cards */}
            {pendingDecisions.length > 0 && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex flex-col gap-2 shrink-0 animate-in fade-in duration-200">
                {pendingDecisions.map((dec) => (
                  <div
                    key={dec.decision_id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#171a24] border border-amber-500/40 rounded-xl p-3.5 shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 shrink-0">
                        <Bot size={18} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            AI 架构决策请求 ({dec.decision_id})
                          </span>
                          {dec.linked_card_id && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              关联卡片: {dec.linked_card_id}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-slate-100">{dec.question_plain}</h4>
                        {dec.context_plain && (
                          <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
                            {dec.context_plain}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {dec.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleResolveDecision(dec.decision_id, opt.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#22293a] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-[#2f3950] text-xs font-medium transition shadow-sm flex items-center gap-1.5 group"
                          title={opt.tradeoff || `选择选项: ${opt.label}`}
                        >
                          <CheckCircle2 size={13} className="text-emerald-400 group-hover:text-slate-950" />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'board' && (
              <BoardView
                cards={cards}
                onMoveCard={handleMoveCard}
                onOpenTest={() => setActiveTab('test')}
                onAddCard={handleCreateCard}
              />
            )}

            {activeTab === 'test' && (
              <TestPreviewView
                project={project}
                cards={cards}
                manifest={manifest}
                onOpenCreateIssue={(init) => {
                  setIssueModalData(init);
                  setIsCreateIssueOpen(true);
                }}
                onRunScript={handleRunScript}
                onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
              />
            )}

            {activeTab === 'issues' && (
              <IssuesView
                issues={issues}
                onRetest={handleRetestIssue}
                onNavigateToTest={() => setActiveTab('test')}
                projectName={project.name}
                projectId={project.project_id}
                onShowToast={(type, msg, actionText, copyText) =>
                  addToast(type, msg, actionText, copyText)
                }
              />
            )}

            {activeTab === 'assets' && <AssetsView project={project} />}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
            {t('topbar.selectProject')}
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <PreflightDoctorModal
        isOpen={isDoctorOpen}
        onClose={() => setIsDoctorOpen(false)}
      />

      <ConflictDoctorModal
        isOpen={isConflictDoctorOpen}
        onClose={() => setIsConflictDoctorOpen(false)}
        projectPath={currentProjectPath}
        onResolved={() => loadProjectData(currentProjectPath)}
      />

      <CreateIssueModal
        isOpen={isCreateIssueOpen}
        initialData={issueModalData}
        onClose={() => setIsCreateIssueOpen(false)}
        onSubmit={handleSubmitIssue}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        currentProject={project}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onSelectProject={(path) => loadProjectData(path)}
        onToggleEnv={async () => {
          if (!project) return;
          const targetPath = currentProjectPathRef.current || currentProjectPath || project.slug;
          await Bridge.stopEnv(targetPath, 'auto');
          setIsEnvRunning(false);
          addToast('info', t('toast.envStopped'));
        }}
        onRebuildEnv={handleRebuildEnv}
        onOpenTerminal={handleOpenContainerTerminal}
        onTakeSnapshot={() => {
          setIsSnapshotModalOpen(true);
        }}
        onTimeMachine={() => {
          if (!project) return;
          setIsTimeMachineOpen(true);
        }}
        onSwitchLang={() => {
          const next = i18n.language.startsWith('zh') ? 'en-US' : 'zh-CN';
          switchLanguage(next);
        }}
        onCleanStorage={() => {
          setActiveTab('assets');
          addToast('success', t('assets.cleanSuccess'));
        }}
        onOpenDoctor={() => setIsDoctorOpen(true)}
        onOpenConflictDoctor={() => setIsConflictDoctorOpen(true)}
        onOpenAgentConnect={() => setIsAgentConnectOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenTrash={() => setIsTrashViewerOpen(true)}
        isEnvRunning={true}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenTrashViewer={() => setIsTrashViewerOpen(true)}
      />

      <TimeMachineModal
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
        projectPath={currentProjectPath}
      />

      <AgentConnectModal
        isOpen={isAgentConnectOpen}
        onClose={() => setIsAgentConnectOpen(false)}
        project={project}
      />

      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        projectPath={currentProjectPath}
      />

      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        project={project}
        onConfirm={handleCreateSnapshotConfirm}
      />

      <TrashConfirmModal
        isOpen={isTrashModalOpen}
        onClose={() => {
          setIsTrashModalOpen(false);
          setProjectToTrash(null);
        }}
        project={projectToTrash}
        onConfirm={handleConfirmTrash}
      />

      <TrashViewerModal
        isOpen={isTrashViewerOpen}
        onClose={() => setIsTrashViewerOpen(false)}
        onProjectRestored={async (restoredPath) => {
          await loadRecentProjects();
          loadProjectData(restoredPath);
        }}
        showToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Workspace Trust Modal for Imported Projects */}
      {isTrustModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141824] border border-[#222938] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsTrustModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
            >
              <X size={16} />
            </button>

            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-1">
              {t('modals.trust.title')}
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {t('modals.trust.desc')}
            </p>

            <div className="p-3 bg-[#0d1017] border border-[#222938] rounded-lg text-[11px] text-slate-300 space-y-1 mb-5">
              <div className="font-semibold text-emerald-400">{t('modals.trust.firewallTitle')}</div>
              <div>• {t('modals.trust.f1')}</div>
              <div>• {t('modals.trust.f2')}</div>
              <div>• {t('modals.trust.f3')}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsTrustModalOpen(false);
                  addToast('success', '已确认为受信任工作区，完整容器运行与测试环境已激活！');
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition"
              >
                {t('modals.trust.trustBtn')}
              </button>
              <button
                onClick={() => setIsTrustModalOpen(false)}
                className="px-4 py-2 bg-[#1e2433] hover:bg-[#283144] text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                {t('modals.trust.readOnlyBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
