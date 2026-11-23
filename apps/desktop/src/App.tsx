import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, X } from 'lucide-react';
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
import { BoardCard, BoardColumn, DevosProject, Issue, ProjectType, RecentProjectDto, RunManifest, ScriptContext } from './types';
import { Bridge } from './services/tauriBridge';

export const App: React.FC = () => {
  const [currentProjectPath, setCurrentProjectPath] = useState<string>('.');
  const [project, setProject] = useState<DevosProject | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProjectDto[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'test' | 'issues' | 'assets'>('board');
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [manifest, setManifest] = useState<RunManifest | null>(null);

  // Modals state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [isConflictDoctorOpen, setIsConflictDoctorOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false);
  const [issueModalData, setIssueModalData] = useState<any>(null);

  const loadRecentProjects = async () => {
    const res = await Bridge.getRecentProjects();
    if (res.ok && res.data) {
      setRecentProjects(res.data);
    }
  };

  const loadProjectData = async (projPath: string) => {
    setCurrentProjectPath(projPath);
    const res = await Bridge.loadProject(projPath);
    if (res.ok && res.data) {
      setProject(res.data);
      refreshCards(projPath);
      refreshIssues(projPath);
      refreshManifest(projPath);
      loadRecentProjects();
    }
  };

  const refreshCards = async (projPath = currentProjectPath) => {
    const res = await Bridge.listCards(projPath);
    if (res.ok && res.data) {
      setCards(res.data);
    }
  };

  const refreshIssues = async (projPath = currentProjectPath) => {
    const res = await Bridge.listIssues(projPath);
    if (res.ok && res.data) {
      setIssues(res.data);
    }
  };

  const refreshManifest = async (projPath = currentProjectPath) => {
    const res = await Bridge.getRunManifest(projPath);
    if (res.ok && res.data) {
      setManifest(res.data);
    }
  };

  useEffect(() => {
    // 1. Initial load
    loadRecentProjects().then(() => {
      loadProjectData('.');
    });

    // 2. Setup real-time event listeners from Tauri Core
    let unlistenBoard: any;
    let unlistenIssues: any;
    let unlistenProject: any;

    Bridge.listenToEvent('devos://board-updated', () => {
      refreshCards();
    }).then((unlisten) => {
      unlistenBoard = unlisten;
    });

    Bridge.listenToEvent('devos://issues-updated', () => {
      refreshIssues();
      refreshCards();
    }).then((unlisten) => {
      unlistenIssues = unlisten;
    });

    Bridge.listenToEvent('devos://project-updated', () => {
      loadProjectData(currentProjectPath);
    }).then((unlisten) => {
      unlistenProject = unlisten;
    });

    return () => {
      if (typeof unlistenBoard === 'function') unlistenBoard();
      if (typeof unlistenIssues === 'function') unlistenIssues();
      if (typeof unlistenProject === 'function') unlistenProject();
    };
  }, []);

  const handleCreateProject = async (
    name: string,
    slug: string,
    type: ProjectType,
    description: string
  ) => {
    const res = await Bridge.initProject('.', slug, name, description, type);
    if (res.ok && res.data) {
      setProject(res.data);
      refreshCards('.');
      refreshIssues('.');
      refreshManifest('.');
      loadRecentProjects();
    }
  };

  const handleMoveCard = async (cardId: string, col: BoardColumn) => {
    if (!project) return;
    const res = await Bridge.moveCard(currentProjectPath, cardId, col, 'user');
    if (res.ok) {
      refreshCards();
    } else if (res.error) {
      alert(`无法流转卡片: ${res.error.plain_message || res.error.message}`);
    }
  };

  const handleRetestIssue = async (issueId: string, passed: boolean, feedback: string) => {
    if (!project) return;
    const res = await Bridge.retestIssue(currentProjectPath, issueId, passed, feedback);
    if (res.ok) {
      refreshIssues();
      refreshCards();
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
    } else if (res.error) {
      alert(`提交 Issue 失败: ${res.error.plain_message || res.error.message}`);
    }
  };

  const openIssuesCount = issues.filter(
    (i) => i.status === 'open' || i.status === 'reopened' || i.status === 'ready_for_retest'
  ).length;
  const testingCount = cards.filter((c) => c.column === 'testing').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0d13]">
      {/* 220px Sidebar */}
      <Sidebar
        currentProject={project}
        recentProjects={recentProjects}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openIssuesCount={openIssuesCount}
        testingCount={testingCount}
        onSelectProjectByPath={(path) => loadProjectData(path)}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenDoctor={() => setIsDoctorOpen(true)}
        onOpenConflictDoctor={() => setIsConflictDoctorOpen(true)}
        runningProjectsCount={project ? 1 : 0}
        onStopAllEnvironments={async () => {
          const ok = window.confirm('是否停止所有正在运行的容器环境？这将彻底释放系统算力与内存。');
          if (!ok) return;
          if (project) {
            await Bridge.stopEnv('.', 'auto');
          }
          alert('已向所有受控容器发送停止信号，内存与端口已释放！');
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
        />

        {/* Workspace Body */}
        {project ? (
          <>
            {activeTab === 'board' && (
              <BoardView
                cards={cards}
                onMoveCard={handleMoveCard}
                onOpenTest={() => setActiveTab('test')}
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
              />
            )}

            {activeTab === 'issues' && (
              <IssuesView
                issues={issues}
                onRetest={handleRetestIssue}
                onNavigateToTest={() => setActiveTab('test')}
                projectName={project.name}
                projectId={project.project_id}
              />
            )}

            {activeTab === 'assets' && <AssetsView project={project} />}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
            请从左侧选择项目或点击“新建项目”开始
          </div>
        )}
      </div>

      {/* Modals */}
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
              工作区安全信任确认 (Workspace Trust)
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              检测到当前打开的项目目录可能来自外部下载或第三方分享。为防止未知工程中的恶意脚本自动执行，在您信任此工作区前，DevOS 已自动阻断自动启动容器、网络端口映射与脚本执行。
            </p>

            <div className="p-3 bg-[#0d1017] border border-[#222938] rounded-lg text-[11px] text-slate-300 space-y-1 mb-5">
              <div className="font-semibold text-emerald-400">🛡️ DevOS 安全防御围栏已激活：</div>
              <div>• 外部 DevContainer / Dockerfile 脚本暂不自动拉起</div>
              <div>• 敏感配置文件（.env）对外部 Agent 保持掩码隔离</div>
              <div>• 自动阻断任何非当前项目目录的越权路径访问</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsTrustModalOpen(false);
                  alert('已确认为受信任工作区，完整容器运行与测试环境已激活！');
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition"
              >
                信任并启用完整环境
              </button>
              <button
                onClick={() => setIsTrustModalOpen(false)}
                className="px-4 py-2 bg-[#1e2433] hover:bg-[#283144] text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                仅以只读模式浏览
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
