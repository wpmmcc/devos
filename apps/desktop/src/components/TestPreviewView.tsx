import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
  Globe,
  Terminal,
  Play,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  ExternalLink,
  Bug,
  FileText,
  CheckSquare,
  Square,
  Camera,
  QrCode,
  Smartphone,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BoardCard, DevosProject, RunManifest, ScriptContext } from '../types';
import { devosProbe } from '../utils/probe';
import { Bridge } from '../services/tauriBridge';

interface TestPreviewViewProps {
  project: DevosProject;
  cards: BoardCard[];
  manifest: RunManifest | null;
  onOpenCreateIssue: (initialData?: any) => void;
  onRunScript: (targetId: string, inputs: Record<string, any>) => Promise<ScriptContext | null>;
  onOpenSnapshotModal?: () => void;
}

export const TestPreviewView: React.FC<TestPreviewViewProps> = ({
  project,
  cards,
  manifest,
  onOpenCreateIssue,
  onRunScript,
  onOpenSnapshotModal,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'web' | 'script'>(
    project.project_type === 'script' ? 'script' : 'web'
  );

  // Web State
  const [previewUrl, setPreviewUrl] = useState(
    project.environments.web?.primary_url || 'https://invoice-helper.ddev.site'
  );
  const testingCard = cards.find((c) => c.column === 'testing');
  const [checklist, setChecklist] = useState(testingCard?.checklist || []);

  // Script Runner State
  const targets = manifest?.targets || [];
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    targets[0]?.id || ''
  );
  const currentTarget = targets.find((t) => t.id === selectedTargetId) || targets[0];
  const [formInputs, setFormInputs] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    if (currentTarget) {
      currentTarget.inputs.forEach((input) => {
        init[input.name] = input.default ?? '';
      });
    }
    return init;
  });
  const [isRunning, setIsRunning] = useState(false);
  const [lastScriptResult, setLastScriptResult] = useState<ScriptContext | null>(null);

  const toggleChecklist = (stepNum: number) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.step === stepNum ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [lanUrl, setLanUrl] = useState('http://192.168.1.108:8080');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isCopiedLan, setIsCopiedLan] = useState(false);

  const openLanModal = () => {
    setIsLanModalOpen(true);
    QRCode.toDataURL(lanUrl, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => {});
  };

  const handleCreateSnapshot = async () => {
    if (onOpenSnapshotModal) {
      onOpenSnapshotModal();
      return;
    }
    const defaultName = `snapshot_${Date.now()}`;
    setIsSnapshotting(true);
    await Bridge.createSnapshot('.', defaultName);
    setIsSnapshotting(false);
  };

  const handleTriggerWebIssue = () => {
    const probeData = devosProbe.getSnapshot();
    onOpenCreateIssue({
      source_type: 'web_preview',
      url: previewUrl,
      console_errors: probeData.console_errors,
      failed_requests: probeData.failed_requests,
      title: '页面功能异常',
      description: '在 Web 页面预览测试时发现异常行为。',
    });
  };

  const handleRunScript = async () => {
    if (!currentTarget) return;
    setIsRunning(true);
    const result = await onRunScript(currentTarget.id, formInputs);
    setLastScriptResult(result);
    setIsRunning(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden select-none">
      {/* Mode Switcher Header */}
      <div className="h-11 px-5 border-b border-[#1e2330] bg-[#12151d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {project.project_type !== 'script' && (
            <button
              onClick={() => setMode('web')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                mode === 'web'
                  ? 'bg-[#1e2433] text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe size={13} />
              <span>{t('testPreview.webTab')}</span>
            </button>
          )}

          {project.project_type !== 'web' && (
            <button
              onClick={() => setMode('script')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                mode === 'script'
                  ? 'bg-[#1e2433] text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal size={13} />
              <span>{t('testPreview.scriptTab')}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'web' && (
            <>
              <button
                onClick={openLanModal}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1a2130] hover:bg-[#232b3d] text-cyan-300 hover:text-white rounded-md text-xs font-medium border border-cyan-800/40 transition"
                title={t('testPreview.lanPreview')}
              >
                <QrCode size={13} className="text-cyan-400" />
                <span>{t('testPreview.lanPreview')}</span>
              </button>

              <button
                onClick={handleCreateSnapshot}
                disabled={isSnapshotting}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1a2130] hover:bg-[#232b3d] text-slate-300 hover:text-white rounded-md text-xs font-medium border border-[#2d374d] transition"
                title={t('topbar.saveSnapshot')}
              >
                <Camera size={13} className="text-amber-400" />
                <span>{isSnapshotting ? t('common.loading') : t('topbar.saveSnapshot')}</span>
              </button>

              <button
                onClick={handleTriggerWebIssue}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-medium shadow-md shadow-rose-950/30 transition animate-bounce"
              >
                <Bug size={13} />
                <span>{t('testPreview.createIssueBtn')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Mode Body */}
      {mode === 'web' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Web Preview Main Area */}
          <div className="flex-1 flex flex-col border-r border-[#1e2330]">
            {/* Simulated Browser Bar */}
            <div className="h-10 bg-[#161a24] border-b border-[#1e2330] px-3 flex items-center gap-2 text-xs">
              <button
                className="p-1 hover:bg-[#232938] rounded text-slate-400 hover:text-slate-200 transition"
                title="刷新页面预览"
              >
                <RotateCw size={12} />
              </button>
              <input
                type="text"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                className="flex-1 bg-[#0f1118] border border-[#232938] rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/50"
              />
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 hover:bg-[#232938] rounded text-slate-400 hover:text-slate-200 transition"
                title="在系统默认浏览器中打开链接"
              >
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Embedded Simulated Preview Content */}
            <div className="flex-1 bg-[#10131b] p-8 flex flex-col items-center justify-center relative">
              <div className="max-w-md w-full bg-[#181d2a] border border-[#262e42] rounded-xl p-6 shadow-xl text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <Globe size={24} />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-1">
                  {project.name} {t('testPreview.webTab')}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  DDEV 本地环境运行中：<span className="text-emerald-400 font-mono">{previewUrl}</span>
                </p>
                <div className="p-3 bg-[#11141c] rounded-lg border border-[#232a3a] text-left text-xs text-slate-300 space-y-1 mb-4">
                  <div className="text-emerald-400 font-medium">✓ 本地 HTTPS 证书已信任</div>
                  <div>✓ 数据库已就绪（支持一键快照）</div>
                  <div>✓ 实时报错探针已注入（提问题时自动附带 30 秒日志与网络错误）</div>
                </div>
                <button
                  onClick={handleTriggerWebIssue}
                  className="w-full py-2 bg-[#22c55e] hover:bg-emerald-500 text-slate-950 font-semibold rounded-lg text-xs transition"
                >
                  {t('testPreview.createIssueBtn')}
                </button>
              </div>
            </div>
          </div>

          {/* Right Acceptance Checklist Panel */}
          <div className="w-80 shrink-0 min-w-[280px] max-w-[340px] bg-[#12151d] p-4 flex flex-col border-l border-[#1e2330]">
            <h4 className="text-xs font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-amber-400" />
              <span>{t('testPreview.checklistTitle', { count: checklist.length })}</span>
            </h4>

            {testingCard ? (
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="p-2.5 bg-[#181d2a] rounded-lg border border-[#232a3a] text-xs text-slate-300">
                  <div className="text-[10px] text-amber-400 font-medium mb-1">
                    任务: {testingCard.title}
                  </div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">
                    {testingCard.summary_plain || t('testPreview.checklistSubtitle')}
                  </div>
                </div>

                <div className="space-y-2">
                  {checklist.map((step) => (
                    <div
                      key={step.step}
                      onClick={() => toggleChecklist(step.step)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                        step.checked
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300'
                          : 'bg-[#151924] border-[#222838] text-slate-200 hover:border-amber-500/30'
                      }`}
                    >
                      <button className="mt-0.5 text-emerald-400">
                        {step.checked ? (
                          <CheckSquare size={14} />
                        ) : (
                          <Square size={14} className="text-slate-500" />
                        )}
                      </button>
                      <div className="flex-1 text-xs">
                        <div className="font-medium mb-0.5">
                          第 {step.step} 步: {step.action}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t('board.expectedResult', { expected: step.expected })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-10">
                {t('testPreview.noTestingCards')}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Script Form Runner Main Area */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Target List */}
          <div className="w-64 bg-[#12151d] border-r border-[#1e2330] p-3 flex flex-col">
            <span className="text-xs text-slate-400 font-medium px-2 mb-2">
              {t('testPreview.scriptList')}
            </span>
            <div className="space-y-1">
              {targets.map((tgt) => (
                <button
                  key={tgt.id}
                  onClick={() => {
                    setSelectedTargetId(tgt.id);
                    const init: Record<string, any> = {};
                    tgt.inputs.forEach((i) => {
                      init[i.name] = i.default ?? '';
                    });
                    setFormInputs(init);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition text-xs ${
                    selectedTargetId === tgt.id
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                      : 'bg-[#151924] border-[#202636] text-slate-300 hover:border-[#2f384e]'
                  }`}
                >
                  <div className="font-medium text-slate-100">{tgt.label}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{tgt.description}</div>
                </button>
              ))}

              {targets.length === 0 && (
                <div className="text-xs text-slate-500 p-4 text-center">
                  {t('common.empty')}
                </div>
              )}
            </div>
          </div>

          {/* Center Form & Output Runner */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            {currentTarget ? (
              <div className="max-w-2xl w-full mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">{currentTarget.label}</h3>
                  <p className="text-xs text-slate-400 mt-1">{currentTarget.description}</p>
                </div>

                {/* Form Controls */}
                <div className="bg-[#141824] p-5 rounded-xl border border-[#22293a] space-y-4">
                  {currentTarget.inputs.map((input) => (
                    <div key={input.name} className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-200 flex items-center justify-between">
                        <span>{input.label}</span>
                        <span className="text-[10px] font-mono text-slate-500">{input.name}</span>
                      </label>

                      {input.type === 'select' ? (
                        <select
                          value={formInputs[input.name] ?? ''}
                          onChange={(e) =>
                            setFormInputs({ ...formInputs, [input.name]: e.target.value })
                          }
                          className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          {input.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : input.type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={!!formInputs[input.name]}
                            onChange={(e) =>
                              setFormInputs({ ...formInputs, [input.name]: e.target.checked })
                            }
                            className="rounded bg-[#0d1017] border-[#283042] text-emerald-500"
                          />
                          <span>开启严格格式校验</span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={formInputs[input.name] ?? ''}
                          onChange={(e) =>
                            setFormInputs({ ...formInputs, [input.name]: e.target.value })
                          }
                          className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      )}
                    </div>
                  ))}

                  <button
                    onClick={handleRunScript}
                    disabled={isRunning}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition"
                    title="运行测试脚本: 在本地沙盒容器中执行选定脚本目标并实时输出日志"
                  >
                    <Play size={13} />
                    <span>{isRunning ? t('testPreview.runningScript') : t('testPreview.runScript')}</span>
                  </button>
                </div>

                {/* Output Console Box */}
                {lastScriptResult && (
                  <div className="bg-[#12151d] rounded-xl border border-[#202738] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {lastScriptResult.exit_code === 0 ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                          <AlertCircle size={16} className="text-rose-400" />
                        )}
                        <span className="text-xs font-semibold text-slate-100">
                          {lastScriptResult.exit_code === 0
                            ? t('testPreview.scriptSuccess', { duration: lastScriptResult.duration_ms })
                            : t('testPreview.scriptFailed', { code: lastScriptResult.exit_code })}
                        </span>
                      </div>

                      {lastScriptResult.exit_code !== 0 && (
                        <button
                          onClick={() =>
                            onOpenCreateIssue({
                              source_type: 'script_run',
                              script: lastScriptResult,
                              title: `脚本 ${currentTarget.label} 运行失败`,
                              description: `退出码 ${lastScriptResult.exit_code}，请协助排查修复。`,
                            })
                          }
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition"
                        >
                          {t('testPreview.convertScriptIssue')}
                        </button>
                      )}
                    </div>

                    <div className="p-3 bg-[#0a0c10] rounded-lg border border-[#1b212f] font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {lastScriptResult.stdout_tail || lastScriptResult.stderr_tail || '运行完成，未产生终端输出。'}
                    </div>

                    {lastScriptResult.output_files_generated && lastScriptResult.output_files_generated.length > 0 && (
                      <div className="pt-2 border-t border-[#1e2330]">
                        <span className="text-[11px] text-slate-400 mb-2 block font-medium">
                          {t('testPreview.outputFiles')}:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {lastScriptResult.output_files_generated.map((filePath) => (
                            <div
                              key={filePath}
                              className="px-2.5 py-1.5 bg-[#181d2a] rounded border border-[#252c3d] text-xs text-slate-200 flex items-center gap-1.5"
                            >
                              <FileText size={12} className="text-emerald-400" />
                              <span>{filePath}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                请从左侧选择一个任务目标开始测试
              </div>
            )}
          </div>
        </div>
      )}

      {/* LAN Mobile QR Code Modal */}
      {isLanModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141824] border border-[#232c3f] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative flex flex-col items-center text-center">
            <button
              onClick={() => setIsLanModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202738] transition"
            >
              <X size={16} />
            </button>

            <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
              <Smartphone size={20} />
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-1">
              {t('testPreview.mobileScan')}
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              确保手机连接在同一个局域网 Wi-Fi 下，用手机相机扫码即可直接访问并验收：
            </p>

            {qrDataUrl ? (
              <div className="p-3 bg-white rounded-xl shadow-lg mb-4">
                <img src={qrDataUrl} alt="LAN QR Code" className="w-44 h-44 rounded" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400 mb-4">
                {t('common.loading')}
              </div>
            )}

            <div className="w-full bg-[#0d1017] border border-[#222938] rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-cyan-300 mb-4">
              <span className="truncate">{lanUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lanUrl);
                  setIsCopiedLan(true);
                  setTimeout(() => setIsCopiedLan(false), 2000);
                }}
                className="ml-2 px-2 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 rounded border border-cyan-800/40 text-[11px] flex items-center gap-1 transition shrink-0"
              >
                {isCopiedLan ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{isCopiedLan ? t('common.copied') : t('testPreview.copyLink')}</span>
              </button>
            </div>

            <button
              onClick={() => setIsLanModalOpen(false)}
              className="w-full py-2 bg-[#1f2535] hover:bg-[#2a3247] text-slate-300 rounded-lg text-xs font-semibold transition"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
