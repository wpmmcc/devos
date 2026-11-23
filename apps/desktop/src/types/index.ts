export type ProjectType = 'web' | 'script' | 'hybrid';
export type ProjectMode = 'DEV_LOCAL' | 'CONTENT_LOCAL' | 'DEPLOY_PROD';

export interface HealthCheckConfig {
  url: string;
  expect_status: number;
  timeout_sec: number;
}

export interface WebEnvironment {
  enabled: boolean;
  driver: string;
  config_dir: string;
  primary_url: string;
  health_check?: HealthCheckConfig;
  snapshot_supported: boolean;
}

export interface ScriptEnvironment {
  enabled: boolean;
  driver: string;
  config_dir: string;
  service_name: string;
  workdir: string;
  non_root_user: string;
  run_manifest: string;
}

export interface DevosProject {
  schema_version: string;
  project_id: string;
  slug: string;
  name: string;
  description: string;
  project_type: ProjectType;
  mode: ProjectMode;
  created_at: string;
  environments: {
    web?: WebEnvironment;
    script?: ScriptEnvironment;
  };
  workspace_paths: {
    requirements: string;
    standards: string;
    board: string;
    issues: string;
    docs: string;
    knowledge: string;
    artifacts: string;
  };
  guardrails: {
    allow_destructive_in_modes: ProjectMode[];
    require_smoke_check_before_testing: boolean;
    protected_paths: string[];
  };
}

export type BoardColumn = 'todo' | 'doing' | 'testing' | 'done';

export interface ChecklistStep {
  step: number;
  action: string;
  expected: string;
  checked?: boolean;
}

export interface BoardCard {
  schema_version: string;
  card_id: string;
  title: string;
  description?: string;
  column: BoardColumn;
  linked_req_id?: string;
  checklist: ChecklistStep[];
  summary_plain?: string;
  run_target_ids: string[];
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export type IssueStatus = 'open' | 'in_progress' | 'ready_for_retest' | 'closed' | 'reopened';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SourceType = 'web_preview' | 'script_run' | 'manual';

export interface UserReport {
  title: string;
  description: string;
  expected_behavior?: string;
}

export interface ConsoleErrorRecord {
  timestamp: string;
  message: string;
}

export interface FailedRequestRecord {
  method: string;
  url: string;
  status: number;
  response_snippet?: string;
}

export interface WebContext {
  url: string;
  viewport: string;
  screenshot_path?: string;
  console_errors: ConsoleErrorRecord[];
  failed_requests: FailedRequestRecord[];
  backend_logs_tail: string[];
}

export interface ScriptContext {
  run_target_id: string;
  command_executed: string;
  inputs_used: Record<string, any>;
  exit_code: number;
  duration_ms: number;
  stdout_tail: string;
  stderr_tail: string;
  output_files_generated: string[];
}

export interface Issue {
  schema_version: string;
  issue_id: string;
  status: IssueStatus;
  severity: IssueSeverity;
  source_type: SourceType;
  linked_card_id?: string;
  linked_checklist_step?: number;
  created_at: string;
  updated_at: string;
  user_report: UserReport;
  captured_context: {
    web?: WebContext;
    script?: ScriptContext;
    env_health?: any;
  };
  resolution: {
    resolved_by?: string;
    resolved_at?: string;
    fix_summary_plain?: string;
    changed_files: string[];
    knowledge_entry_id?: string;
  };
  retest_history: Array<{
    retested_at: string;
    passed: boolean;
    feedback_plain: string;
  }>;
}

export interface RunInput {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'directory';
  required: boolean;
  default?: any;
  options?: string[];
}

export interface RunTarget {
  id: string;
  label: string;
  description: string;
  env: string;
  command: string;
  timeout_sec: number;
  inputs: RunInput[];
  expected_outputs: Array<{
    path: string;
    label: string;
    preview_type: string;
  }>;
}

export interface RunManifest {
  schema_version: string;
  targets: RunTarget[];
}

export interface DiagnosticItem {
  key: string;
  title: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix_hint?: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    hint?: string;
    plain_message?: string;
  };
}
