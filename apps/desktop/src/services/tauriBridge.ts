import { ApiResponse, BoardCard, DevosProject, DiagnosticItem, Issue, RunManifest, ScriptContext } from '../types';

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
};

// Mock Fallbacks for Browser
function mockHandler<T>(cmd: string, args: Record<string, any>): ApiResponse<T> {
  if (cmd === 'run_preflight_doctor') {
    return {
      ok: true,
      data: [
        { key: 'docker', title: 'Docker 容器引擎', status: 'ok', message: 'Docker Desktop / OrbStack 运行中' },
        { key: 'ddev', title: 'DDEV 网页与数据库环境', status: 'ok', message: '已安装 v1.25.5' },
        { key: 'devcontainer', title: 'Dev Container 脚本环境', status: 'warning', message: '未检测到 @devcontainers/cli 命令', fix_hint: '可在终端执行 npm i -g @devcontainers/cli' },
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

  return { ok: true, data: null as any };
}
