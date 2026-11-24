// DevOS Unified Types - Single-Source re-exported from Rust ts-rs bindings
export * from './generated';

import type { CheckpointInfo } from './generated/CheckpointInfo';

// Aliases and UI-specific extensions
export type Checkpoint = CheckpointInfo;

export interface RecentProjectDto {
  path: string;
  name: string;
  project_type: string;
}

export interface DiagnosticItem {
  key: string;
  title: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix_hint?: string;
}
