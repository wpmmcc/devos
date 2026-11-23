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
import { BoardCard, BoardColumn, DevosProject, Issue, ProjectType, RunManifest, ScriptContext } from './types';
import { Bridge } from './services/tauriBridge';

export const App: React.FC = () => {
  const [project, setProject] = useState<DevosProject | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'test' | 'issues' | 'assets'>('board');
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [manifest, setManifest] = useState<RunManifest | null>(null);

  // Modals state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [issueModalData, setIssueModalData] = useState<any>(null);

  // Load initial demo project or project from path
  const loadProjectData = async (projPath: string) => {
    const res = await Bridge.loadProject(projPath);
    if (res.ok && res.data) {
      setProject(res.data);
      refreshCards(projPath);
      refreshIssues(projPath);
      refreshManifest(projPath);
    }
  };

  const refreshCards = async (projPath: string) => {
    const res = await Bridge.listCards(projPath);
    if (res.ok && res.data) {
      setCards(res.data);
    }
  };

  const refreshIssues = async (projPath: string) => {
    const res = await Bridge.listIssues(projPath);
    if (res.ok && res.data) {
      setIssues(res.data);
    }
  };

  const refreshManifest = async (projPath: string) => {
    const res = await Bridge.getRunManifest(projPath);
    if (res.ok && res.data) {
      setManifest(res.data);
    }
  };

  useEffect(() => {
    // Load default project on start
    loadProjectData('.');
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
    }
  };

  const handleMoveCard = async (cardId: string, col: BoardColumn) => {
    if (!project) return;
    const res = await Bridge.moveCard('.', cardId, col, 'user');
    if (res.ok) {
      refreshCards('.');
    } else if (res.error) {
      alert(`无法流转卡片: ${res.error.plain_message || res.error.message}`);
    }
  };

  const handleRetestIssue = async (issueId: string, passed: boolean, feedback: string) => {
    if (!project) return;
    const res = await Bridge.retestIssue('.', issueId, passed, feedback);
    if (res.ok) {
      refreshIssues('.');
      refreshCards('.');
    }
  };

  const handleRunScript = async (
    targetId: string,
    inputs: Record<string, any>
  ): Promise<ScriptContext | null> => {
    if (!project) return null;
    const res = await Bridge.executeScript('.', targetId, inputs);
    return res.ok && res.data ? res.data : null;
  };

  const handleSubmitIssue = async (
    title: string,
    description: string,
    expected: string,
    data: any
  ) => {
    if (!project) return;
    const res = await Bridge.createWebIssue(
      '.',
      title,
      description,
      data?.url || 'https://invoice-helper.ddev.site',
      expected,
      [],
      []
    );
    if (res.ok) {
      refreshIssues('.');
      setActiveTab('issues');
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
        onSelectProject={(p) => setProject(p)}
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
