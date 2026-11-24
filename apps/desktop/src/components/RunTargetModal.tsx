import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Terminal,
  Save,
  Check,
  AlertCircle,
  Clock,
  Box,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RunManifest, RunTarget } from '../types';
import { Bridge } from '../services/tauriBridge';

interface RunTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  manifest: RunManifest | null;
  onManifestUpdated: (newManifest: RunManifest) => void;
}

export const RunTargetModal: React.FC<RunTargetModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  manifest,
  onManifestUpdated,
}) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const targets = manifest?.targets || [];
  const [editingTarget, setEditingTarget] = useState<RunTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state for creating or editing a target
  const [formId, setFormId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formEnv, setFormEnv] = useState('script');
  const [formTimeout, setFormTimeout] = useState(60);

  const startEdit = (target?: RunTarget) => {
    setErrorMsg(null);
    if (target) {
      setEditingTarget(target);
      setFormId(target.id);
      setFormLabel(target.label);
      setFormDescription(target.description);
      setFormCommand(target.command);
      setFormEnv(target.env || 'script');
      setFormTimeout(target.timeout_sec || 60);
    } else {
      setEditingTarget({
        id: '',
        label: '',
        description: '',
        env: 'script',
        command: '',
        timeout_sec: 60,
        inputs: [],
        expected_outputs: [],
      });
      setFormId(`target_${Date.now().toString(36)}`);
      setFormLabel('');
      setFormDescription('');
      setFormCommand('');
      setFormEnv('script');
      setFormTimeout(60);
    }
  };

  const handleSaveForm = async () => {
    if (!formId.trim() || !formCommand.trim() || !formLabel.trim()) {
      setErrorMsg(isEn ? 'Please fill in Target ID, Label, and Command' : '请填写完整的目标 ID、目标名称与执行指令');
      return;
    }

    const updatedTarget: RunTarget = {
      id: formId.trim(),
      label: formLabel.trim(),
      description: formDescription.trim(),
      command: formCommand.trim(),
      env: formEnv,
      timeout_sec: Number(formTimeout) || 60,
      inputs: editingTarget?.inputs || [],
      expected_outputs: editingTarget?.expected_outputs || [],
    };

    let newTargets = [...targets];
    const existingIdx = newTargets.findIndex((t) => t.id === formId.trim());

    if (existingIdx >= 0) {
      newTargets[existingIdx] = updatedTarget;
    } else {
      newTargets.push(updatedTarget);
    }

    const newManifest: RunManifest = {
      schema_version: manifest?.schema_version || '1.0',
      targets: newTargets,
    };

    setIsSaving(true);
    try {
      const res = await Bridge.saveRunManifest(projectPath, newManifest);
      if (res.ok) {
        onManifestUpdated(newManifest);
        setEditingTarget(null);
      } else {
        setErrorMsg(res.error?.message || '保存 devos.run.json 失败');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (targetId: string) => {
    const newTargets = targets.filter((t) => t.id !== targetId);
    const newManifest: RunManifest = {
      schema_version: manifest?.schema_version || '1.0',
      targets: newTargets,
    };

    setIsSaving(true);
    try {
      const res = await Bridge.saveRunManifest(projectPath, newManifest);
      if (res.ok) {
        onManifestUpdated(newManifest);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#121622] border border-[#232b3d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1f2637] flex items-center justify-between bg-[#0b0e15]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-400">
              <Terminal size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{isEn ? 'Configure Run Targets' : '可视化指令与测试目标配置'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  devos.run.json
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn
                  ? 'Define script commands, container isolation, and test manifests visually.'
                  : '直接可视化增删改测试指令目标，配置自动持久化至 devos.run.json。'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-[#1a202e] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-950/50 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-400" />
              <span>{errorMsg}</span>
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
              ✕
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {editingTarget ? (
            /* Target Editor Form */
            <div className="bg-[#0b0e15] border border-[#222b3d] rounded-xl p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[#1d2535] pb-3">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Terminal size={14} className="text-emerald-400" />
                  <span>{editingTarget.id ? '编辑目标指令' : '新建目标指令'}</span>
                </span>
                <button
                  onClick={() => setEditingTarget(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  取消编辑
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">目标唯一 ID (ID)</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="如: run_pytest, build_bundle"
                    className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-1.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">展示名称 (Label)</label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="如: 单元自动化复验"
                    className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-1.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 mb-1">功能描述 (Description)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="如: 运行容器内 pytest 并捕获测试结果与覆盖率"
                  className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-1.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 mb-1">执行命令 (Command in Container)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formCommand}
                    onChange={(e) => setFormCommand(e.target.value)}
                    placeholder="如: pytest tests/ -v 或 npm test"
                    className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-2 text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 flex items-center gap-1">
                    <Box size={12} />
                    <span>运行隔离环境 (Environment)</span>
                  </label>
                  <select
                    value={formEnv}
                    onChange={(e) => setFormEnv(e.target.value)}
                    className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="script">Script 容器沙盒 (DevContainer / Host)</option>
                    <option value="devcontainer">DevContainer (VS Code 规范)</option>
                    <option value="ddev">DDEV Web 容器沙盒</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 flex items-center gap-1">
                    <Clock size={12} />
                    <span>超时保护 (Timeout Seconds)</span>
                  </label>
                  <input
                    type="number"
                    value={formTimeout}
                    onChange={(e) => setFormTimeout(Number(e.target.value))}
                    min={5}
                    max={3600}
                    className="w-full bg-[#131824] border border-[#283247] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1d2535]">
                <button
                  onClick={() => setEditingTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-[#161c28]"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>保存目标配置</span>
                </button>
              </div>
            </div>
          ) : (
            /* Target List View */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  当前已注册目标 ({targets.length})
                </span>
                <button
                  onClick={() => startEdit()}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>新建目标指令</span>
                </button>
              </div>

              {targets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border border-dashed border-[#232b3d] rounded-xl space-y-2">
                  <Terminal size={32} className="mx-auto text-slate-600" />
                  <div className="text-xs">暂无配置的运行目标</div>
                  <button
                    onClick={() => startEdit()}
                    className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg mt-2"
                  >
                    立即创建第一个指令
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {targets.map((tgt) => (
                    <div
                      key={tgt.id}
                      className="p-3 bg-[#0d1017] border border-[#1e2535] hover:border-emerald-500/30 rounded-xl transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{tgt.label}</span>
                          <span className="font-mono text-[10px] text-slate-500 bg-[#141924] px-1.5 py-0.5 rounded border border-[#222b3b]">
                            {tgt.id}
                          </span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-800/30">
                            {tgt.env}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-emerald-300 bg-[#080a0f] px-2 py-1 rounded border border-[#171d2b] truncate">
                          $ {tgt.command}
                        </div>
                        {tgt.description && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {tgt.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(tgt)}
                          className="p-1.5 rounded-lg bg-[#151a26] hover:bg-[#20273a] text-slate-300 hover:text-emerald-400 transition"
                          title="编辑目标"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(tgt.id)}
                          className="p-1.5 rounded-lg bg-[#151a26] hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 transition"
                          title="删除目标"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0a0d13] border-t border-[#1e2536] text-[11px] text-slate-500 flex items-center justify-between">
          <span>修改后将自动保存并同步至项目根目录 devos.run.json</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-[#161c28] hover:bg-[#202738] text-slate-300 text-xs transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
