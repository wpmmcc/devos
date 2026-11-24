import {
  ApiResponse,
  BoardCard,
  DevosProject,
  DiagnosticItem,
  Issue,
  LogEntry,
  LogFilter,
  RunManifest,
  ScriptContext,
} from '../types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<ApiResponse<T>> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ApiResponse<T>>(cmd, args);
    } catch (err: any) {
      return {
        ok: false,
        error: {
          code: 'TAURI_INVOKE_ERROR',
          message: String(err),
          plain_message: '本地应用调用异常: ' + String(err),
        },
      };
    }
  }

  // Browser Mock Mode for pure frontend dev/preview
  console.log(`[Mock Tauri] ${cmd}`, args);
  return mockHandler<T>(cmd, args);
}

export const Bridge = {
  runDoctor: () => invokeTauri<DiagnosticItem[]>('run_preflight_doctor'),
  autoFixEnvironment: () => invokeTauri<DiagnosticItem[]>('auto_fix_environment'),

  getRecentProjects: () => invokeTauri<Array<{ path: string; name: string; project_type: string }>>('get_recent_projects'),

  listenToEvent: async (eventName: string, handler: (payload: any) => void) => {
    if (isTauri()) {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        return await listen(eventName, (event) => handler(event.payload));
      } catch (err) {
        console.error('Failed to listen to event:', err);
      }
    }
    return () => {};
  },

  initProject: (targetPath: string, slug: string, name: string, description: string, projectType: string) =>
    invokeTauri<DevosProject>('init_project', {
      targetPath,
      slug,
      name,
      description,
      projectType,
    }),

  loadProject: (projectPath: string) =>
    invokeTauri<DevosProject>('load_project', { projectPath }),

  listCards: (projectPath: string) =>
    invokeTauri<BoardCard[]>('list_board_cards', { projectPath }),

  moveCard: (projectPath: string, cardId: string, column: string, updatedBy = 'user') =>
    invokeTauri<BoardCard>('move_board_card', { projectPath, cardId, column, updatedBy }),

  createCard: (projectPath: string, title: string) =>
    invokeTauri<BoardCard>('create_board_card', { projectPath, title }),

  listIssues: (projectPath: string, status?: string) =>
    invokeTauri<Issue[]>('list_issues', { projectPath, status }),

  createWebIssue: (
    projectPath: string,
    title: string,
    description: string,
    url: string,
    expectedBehavior?: string,
    consoleErrors: any[] = [],
    failedRequests: any[] = []
  ) =>
    invokeTauri<Issue>('create_web_issue', {
      projectPath,
      title,
      description,
      expectedBehavior,
      url,
      screenshotPath: null,
      consoleErrors,
      failedRequests,
    }),

  createScriptIssue: (
    projectPath: string,
    title: string,
    description: string,
    expectedBehavior?: string,
    scriptContext?: ScriptContext
  ) =>
    invokeTauri<Issue>('create_script_issue', {
      projectPath,
      title,
      description,
      expectedBehavior,
      scriptContext,
    }),

  retestIssue: (projectPath: string, issueId: string, passed: boolean, feedback: string) =>
    invokeTauri<Issue>('retest_issue', { projectPath, issueId, passed, feedback }),

  getRunManifest: (projectPath: string) =>
    invokeTauri<RunManifest>('get_run_manifest', { projectPath }),

  executeScript: (projectPath: string, targetId: string, inputs: Record<string, any>) =>
    invokeTauri<ScriptContext>('execute_script_target', { projectPath, targetId, inputs }),

  getEnvStatus: (projectPath: string, target: string) =>
    invokeTauri<any>('get_env_status', { projectPath, target }),

  startEnv: (projectPath: string, target: string) =>
    invokeTauri<any>('start_environment', { projectPath, target }),

  stopEnv: (projectPath: string, target: string) =>
    invokeTauri<boolean>('stop_environment', { projectPath, target }),

  createSnapshot: (projectPath: string, name = '') =>
    invokeTauri<string>('create_snapshot', { projectPath, name }),

  restoreSnapshot: (projectPath: string, name: string) =>
    invokeTauri<string>('restore_snapshot', { projectPath, name }),

  detectAgents: (projectPath?: string) =>
    invokeTauri<any[]>('detect_installed_agents', { projectPath }),

  applyAgentConfig: (agentId: string, projectPath?: string) =>
    invokeTauri<string>('apply_agent_config', { agentId, projectPath }),

  uninstallAgentConfig: (agentId: string, projectPath?: string) =>
    invokeTauri<string>('uninstall_agent_config', { agentId, projectPath }),

  getManualConfigSnippet: (agentId: string) =>
    invokeTauri<string>('get_manual_config_snippet', { agentId }),

  verifyAgentConnection: (agentId: string, projectPath?: string) =>
    invokeTauri<boolean>('verify_agent_connection', { agentId, projectPath }),

  inspectPortOccupant: (port: number) =>
    invokeTauri<{
      port: number;
      is_occupied: boolean;
      pid?: number;
      process_name?: string;
      command_line?: string;
      suggested_action?: string;
    }>('inspect_port_occupant', { port }),

  reconfigureWebPorts: (projectPath: string, httpPort: number, httpsPort: number) =>
    invokeTauri<string>('reconfigure_web_ports', { projectPath, httpPort, httpsPort }),

  getMirrorsConfig: () =>
    invokeTauri<any>('get_mirrors_config'),

  saveMirrorsConfig: (config: any) =>
    invokeTauri<boolean>('save_mirrors_config', { config }),

  raceMirrorsSpeed: (candidates: string[]) =>
    invokeTauri<{ selected_url: string; latency_ms: number; error?: string }>('race_mirrors_speed', { candidates }),

  importLocalToolPackage: (toolName: string, sourcePath: string) =>
    invokeTauri<string>('import_local_tool_package', { toolName, sourcePath }),

  exportDiagnosticBundle: (projectPath?: string) =>
    invokeTauri<string>('export_diagnostic_bundle', { projectPath }),

  getLogs: (filter?: LogFilter) =>
    invokeTauri<LogEntry[]>('get_logs', { filter }),

  clearLogs: () =>
    invokeTauri<boolean>('clear_logs'),

  appendLog: (level: string, source: string, message: string, projectSlug?: string) =>
    invokeTauri<boolean>('append_log', { level, source, message, projectSlug }),

  getContainerLogs: (projectPath: string, tail?: number) =>
    invokeTauri<string[]>('get_container_logs', { projectPath, tail }),

  exportReleaseBundle: (projectPath: string, version: string, panelFriendly: boolean) =>
    invokeTauri<any>('export_release_bundle', { projectPath, version, panelFriendly }),

  listCheckpoints: (projectPath: string) =>
    invokeTauri<any[]>('list_vcs_checkpoints', { projectPath }),

  createCheckpoint: (projectPath: string, note: string, source = 'user_manual') =>
    invokeTauri<any>('create_vcs_checkpoint', { projectPath, note, source }),

  restoreCheckpoint: (projectPath: string, checkpointId: string) =>
    invokeTauri<boolean>('restore_vcs_checkpoint', { projectPath, checkpointId }),

  getStorageReport: (projectPath: string) =>
    invokeTauri<{
      artifacts_bytes: number;
      logs_bytes: number;
      checkpoints_bytes: number;
      total_project_bytes: number;
      host_available_gb: number;
      low_disk_warning: boolean;
    }>('get_storage_report', { projectPath }),

  cleanStorage: (projectPath: string, olderThanDays: number, pruneDocker: boolean) =>
    invokeTauri<number>('clean_storage', { projectPath, olderThanDays, pruneDocker }),

  trashProject: (projectPath: string) =>
    invokeTauri<string>('trash_project', { projectPath }),

  listDeployPlugins: () =>
    invokeTauri<any[]>('list_deploy_plugins'),

  validateDeployTarget: (pluginId: string, host: string, port: number, user: string) =>
    invokeTauri<{ connected: boolean; remote_docker_version?: string; free_disk_gb?: number; message: string }>(
      'validate_deploy_target',
      { pluginId, host, port, user }
    ),

  planDeployment: (pluginId: string, projectPath: string, host: string, deployDir: string) =>
    invokeTauri<{ plugin_id: string; target_host: string; target_directory: string; summary_plain: string }>(
      'plan_deployment',
      { pluginId, projectPath, host, deployDir }
    ),

  applyDeployment: (pluginId: string, projectPath: string, host: string, deployDir: string) =>
    invokeTauri<{ ok: boolean; online_url?: string; deployed_version: string; sanitized_log?: string }>(
      'apply_deployment',
      { pluginId, projectPath, host, deployDir }
    ),

  rollbackDeployment: (pluginId: string, host: string, version: string) =>
    invokeTauri<{ ok: boolean; online_url?: string; deployed_version: string; sanitized_log?: string }>(
      'rollback_deployment',
      { pluginId, host, version }
    ),
};

// Mock Fallbacks for Browser
function mockHandler<T>(cmd: string, args: Record<string, any>): ApiResponse<T> {
  if (cmd === 'run_preflight_doctor') {
    return {
      ok: true,
      data: [
        { key: 'docker', title: 'Docker 容器引擎', status: 'ok', message: 'Docker Desktop / OrbStack 运行中' },
        { key: 'ddev', title: 'DDEV 网页与数据库环境', status: 'ok', message: '已安装 v1.25.5' },
        { key: 'devcontainer', title: 'Dev Container 脚本环境', status: 'ok', message: '已安装 0.91.0' },
        { key: 'proxy', title: '本地网络代理环境', status: 'ok', message: '未检测到代理劫持风险，本地直连正常' },
      ] as any,
    };
  }

  if (cmd === 'auto_fix_environment') {
    return {
      ok: true,
      data: [
        { key: 'docker', title: 'Docker 容器引擎', status: 'ok', message: 'Docker Desktop / OrbStack 运行中' },
        { key: 'ddev', title: 'DDEV 网页与数据库环境', status: 'ok', message: '已安装 v1.25.5' },
        { key: 'devcontainer', title: 'Dev Container 脚本环境', status: 'ok', message: '已自动安装并就绪: 0.91.0' },
        { key: 'proxy', title: '本地网络代理环境', status: 'ok', message: '未检测到代理劫持风险，本地直连正常' },
      ] as any,
    };
  }

  if (cmd === 'get_recent_projects') {
    return {
      ok: true,
      data: [
        { path: '.', name: '发票自动整理与查看系统', project_type: 'hybrid' },
      ] as any,
    };
  }

  if (cmd === 'load_project' || cmd === 'init_project') {
    return {
      ok: true,
      data: {
        schema_version: '1.0',
        project_id: 'proj_demo123',
        slug: args.slug || 'demo-project',
        name: args.name || '发票自动整理与查看系统',
        description: '支持 PDF 解析导出 Excel 与网页快速查看',
        project_type: 'hybrid',
        mode: 'DEV_LOCAL',
        created_at: new Date().toISOString(),
        environments: {
          web: {
            enabled: true,
            driver: 'ddev',
            config_dir: '.ddev',
            primary_url: 'https://invoice-helper.ddev.site',
            snapshot_supported: true,
          },
          script: {
            enabled: true,
            driver: 'devcontainer',
            config_dir: '.devcontainer',
            service_name: 'app',
            workdir: '/workspace',
            non_root_user: 'vscode',
            run_manifest: 'devos.run.json',
          },
        },
        workspace_paths: {
          requirements: 'requirements/',
          standards: 'standards/',
          board: 'board/',
          issues: 'issues/',
          docs: 'docs/',
          knowledge: 'knowledge/',
          artifacts: '.devos/artifacts/',
        },
        guardrails: {
          allow_destructive_in_modes: ['DEV_LOCAL'],
          require_smoke_check_before_testing: true,
          protected_paths: ['.env', '.ddev/config.yaml'],
        },
      } as any,
    };
  }

  if (cmd === 'list_board_cards') {
    return {
      ok: true,
      data: [
        {
          schema_version: '1.0',
          card_id: 'CARD-001',
          title: 'PDF 发票解析核心算法',
          column: 'done',
          updated_by: 'agent',
          checklist: [],
          run_target_ids: ['parse_invoices'],
          created_at: '2026-11-23T06:00:00Z',
          updated_at: '2026-11-23T07:00:00Z',
        },
        {
          schema_version: '1.0',
          card_id: 'CARD-002',
          title: '批量导出 Excel 功能与税号校验',
          column: 'testing',
          summary_plain: '已支持按指定文件夹批量导出，请根据下方验收清单进行测试。',
          updated_by: 'agent',
          checklist: [
            { step: 1, action: '打开脚本测试台选择 sample_data/invoices', expected: '表单自动读取', checked: true },
            { step: 2, action: '点击“运行测试”按钮', expected: '在 10 秒内执行完成并生成 invoices_result.xlsx', checked: true },
            { step: 3, action: '检查导出的 Excel 表格', expected: '税号和金额列无空值', checked: false },
          ],
          run_target_ids: ['parse_invoices'],
          created_at: '2026-11-23T07:10:00Z',
          updated_at: '2026-11-23T07:30:00Z',
        },
        {
          schema_version: '1.0',
          card_id: 'CARD-003',
          title: '发票列表 Web 查看与搜索页面',
          column: 'doing',
          updated_by: 'agent',
          checklist: [],
          run_target_ids: [],
          created_at: '2026-11-23T08:00:00Z',
          updated_at: '2026-11-23T08:15:00Z',
        },
      ] as any,
    };
  }

  if (cmd === 'list_issues') {
    return {
      ok: true,
      data: [
        {
          schema_version: '1.0',
          issue_id: 'ISS-001',
          status: 'ready_for_retest',
          severity: 'high',
          source_type: 'script_run',
          linked_card_id: 'CARD-002',
          created_at: '2026-11-23T07:40:00Z',
          updated_at: '2026-11-23T08:10:00Z',
          user_report: {
            title: '运行测试报错缺少 openpyxl 依赖',
            description: '点击运行测试后提示 ModuleNotFoundError',
            expected_behavior: '应正常导出 Excel 表格',
          },
          captured_context: {
            script: {
              run_target_id: 'parse_invoices',
              command_executed: 'python scripts/parse_invoices.py',
              inputs_used: {},
              exit_code: 1,
              duration_ms: 850,
              stdout_tail: '',
              stderr_tail: "ModuleNotFoundError: No module named 'openpyxl'",
              output_files_generated: [],
            },
          },
          resolution: {
            resolved_by: 'agent',
            resolved_at: '2026-11-23T08:10:00Z',
            fix_summary_plain: '已在容器依赖清单中补齐 openpyxl 库，并在测试沙盒中复验通过。',
            changed_files: ['requirements.txt', 'scripts/parse_invoices.py'],
            knowledge_entry_id: 'KB-ISS-001',
          },
          retest_history: [],
        },
      ] as any,
    };
  }

  if (cmd === 'get_run_manifest') {
    return {
      ok: true,
      data: {
        schema_version: '1.0',
        targets: [
          {
            id: 'parse_invoices',
            label: '批量解析 PDF 发票',
            description: '从指定文件夹读取 PDF，提取抬头、税号、金额并输出 Excel。',
            env: 'script',
            command: 'python scripts/parse_invoices.py --input {{input_dir}} --currency {{currency}} --strict {{strict_mode}} --out {{output_file}}',
            timeout_sec: 120,
            inputs: [
              { name: 'input_dir', label: '发票所在目录', type: 'directory', required: true, default: 'sample_data/invoices' },
              { name: 'currency', label: '默认币种', type: 'select', required: true, options: ['CNY', 'USD', 'SGD'], default: 'CNY' },
              { name: 'strict_mode', label: '严格校验税号格式', type: 'boolean', required: false, default: true },
              { name: 'output_file', label: '导出文件名', type: 'string', required: true, default: '.devos/artifacts/invoices_result.xlsx' },
            ],
            expected_outputs: [
              { path: '.devos/artifacts/invoices_result.xlsx', label: '生成的 Excel 报表', preview_type: 'table_or_download' },
            ],
          },
        ],
      } as any,
    };
  }

  if (cmd === 'export_release_bundle') {
    return {
      ok: true,
      data: {
        version: args.version || 'v1.0.0',
        release_dir: `releases/${args.version || 'v1.0.0'}`,
        zip_archive_path: `releases/demo-${args.version || 'v1.0.0'}.zip`,
        preflight_gates: [
          { gate_name: 'Git 工作区洁净检查', passed: true, message: 'Git 工作区状态整洁，无未提交的脏改动', details: [] },
          { gate_name: '源码凭据与高危 Token 扫描', passed: true, message: '未检出硬编码密钥或明文 Token 泄漏', details: [] },
          { gate_name: '生产环境变量模板说明覆盖度', passed: true, message: '生产环境变量均已在模板与说明清单中完整声明', details: [] },
          { gate_name: '生产编排规范与健康探针门禁', passed: true, message: '生产配置具备重启策略与自动存活探测', details: [] },
        ],
      } as any,
    };
  }

  if (cmd === 'list_vcs_checkpoints') {
    return {
      ok: true,
      data: [
        { id: 'cp_initial_scaffold', created_at: new Date(Date.now() - 3600000).toISOString(), note: '项目初始化脚手架快照', source: 'user_manual' },
        { id: 'cp_before_refactor', created_at: new Date().toISOString(), note: 'Agent 处理任务前自动时光机快照', source: 'agent_auto' },
      ] as any,
    };
  }

  if (cmd === 'create_vcs_checkpoint') {
    return {
      ok: true,
      data: {
        id: `cp_${Date.now().toString(36)}`,
        created_at: new Date().toISOString(),
        note: args.note || '手动创建的时光机快照',
        source: args.source || 'user_manual',
      } as any,
    };
  }

  if (cmd === 'restore_vcs_checkpoint') {
    return { ok: true, data: true as any };
  }

  if (cmd === 'get_storage_report') {
    return {
      ok: true,
      data: {
        artifacts_bytes: 128 * 1024 * 1024,
        logs_bytes: 46 * 1024 * 1024,
        checkpoints_bytes: 168 * 1024 * 1024,
        total_project_bytes: 342 * 1024 * 1024,
        host_available_gb: 184.2,
        low_disk_warning: false,
      } as any,
    };
  }

  if (cmd === 'clean_storage') {
    return { ok: true, data: 174 * 1024 * 1024 as any };
  }

  if (cmd === 'trash_project') {
    return { ok: true, data: '~/.devos/trash/demo' as any };
  }

  if (cmd === 'list_deploy_plugins') {
    return {
      ok: true,
      data: [
        {
          id: 'vps-docker',
          name: '通用 Linux VPS (SSH + Docker Compose)',
          version: '1.0.0',
          description: '面向任意安装了 Docker 的云主机/VPS，通过 SSH 自动化上传交付包、拉起容器编排并实现保留回滚。',
          plugin_type: 'Recipe',
        },
      ] as any,
    };
  }

  if (cmd === 'validate_deploy_target') {
    return {
      ok: true,
      data: {
        connected: true,
        remote_docker_version: 'Docker 26.1.4 (API 1.45)',
        free_disk_gb: 38.6,
        message: '目标主机连通性与 Docker 运行环境检测通过',
      } as any,
    };
  }

  if (cmd === 'plan_deployment') {
    return {
      ok: true,
      data: {
        plugin_id: args.pluginId || 'vps-docker',
        target_host: args.host || '127.0.0.1',
        target_directory: args.deployDir || '/opt/apps',
        summary_plain: `即将向服务器 ${args.host || '127.0.0.1'} 推送生产镜像构建文件与编排清单，并启动容器`,
      } as any,
    };
  }

  if (cmd === 'apply_deployment') {
    return {
      ok: true,
      data: {
        ok: true,
        online_url: `http://${args.host || '127.0.0.1'}:8080`,
        deployed_version: 'v1.0.0',
        sanitized_log: 'Deployed successfully via SSH Docker Compose plugin.',
      } as any,
    };
  }

  if (cmd === 'rollback_deployment') {
    return {
      ok: true,
      data: {
        ok: true,
        online_url: `http://${args.host || '127.0.0.1'}:8080`,
        deployed_version: args.version || 'v0.9.0',
        sanitized_log: `Rolled back to previous version ${args.version || 'v0.9.0'}.`,
      } as any,
    };
  }

  if (cmd === 'get_logs') {
    return {
      ok: true,
      data: [
        {
          id: 'log_mock_1',
          timestamp: new Date().toISOString(),
          level: 'INFO',
          source: 'core',
          message: 'DevOS workbench core initialized successfully.',
        },
        {
          id: 'log_mock_2',
          timestamp: new Date().toISOString(),
          level: 'INFO',
          source: 'env',
          message: 'DDEV container router bound to port 80/443.',
        },
      ] as any,
    };
  }

  if (cmd === 'clear_logs' || cmd === 'append_log') {
    return { ok: true, data: true as any };
  }

  if (cmd === 'get_container_logs') {
    return {
      ok: true,
      data: [
        '[ddev-router] Starting Nginx reverse proxy...',
        '[ddev-web] Ready for HTTP connections on port 80',
      ] as any,
    };
  }

  if (cmd === 'create_board_card') {
    const newCard = {
      schema_version: '1.0',
      card_id: `CARD-${Math.floor(Math.random() * 900) + 100}`,
      title: args.title || '新增任务',
      column: 'todo',
      summary_plain: '',
      updated_by: 'user',
      checklist: [],
      run_target_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { ok: true, data: newCard as any };
  }

  return { ok: true, data: null as any };
}
