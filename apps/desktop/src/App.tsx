import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BoardView } from './components/BoardView';
import { TestPreviewView } from './components/TestPreviewView';
import { IssuesView } from './components/IssuesView';
import { AssetsView } from './components/AssetsView';
import { NewProjectModal } from './components/NewProjectModal';
import { PreflightDoctorModal } from './components/PreflightDoctorModal';
import { CreateIssueModal } from './components/CreateIssueModal';
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
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
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

      <CreateIssueModal
        isOpen={isCreateIssueOpen}
        initialData={issueModalData}
        onClose={() => setIsCreateIssueOpen(false)}
        onSubmit={handleSubmitIssue}
      />
    </div>
  );
};
