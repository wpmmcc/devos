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
  Save,
  Power,
  QrCode,
  Smartphone,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { BoardCard, DevosProject, RunManifest, RunTarget, ScriptContext } from '../types';
import { devosProbe } from '../utils/probe';
import { Bridge } from '../services/tauriBridge';

interface TestPreviewViewProps {
  project: DevosProject;
  cards: BoardCard[];
  manifest: RunManifest | null;
  onOpenCreateIssue: (initialData?: any) => void;
  onRunScript: (targetId: string, inputs: Record<string, any>) => Promise<ScriptContext | null>;
}

export const TestPreviewView: React.FC<TestPreviewViewProps> = ({
  project,
  cards,
  manifest,
  onOpenCreateIssue,
  onRunScript,
}) => {
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
    QRCode.toDataURL(lanUrl, { width: 180, margin: 1 }).then(setQrDataUrl).catch(() => {});
  };

  const handleCreateSnapshot = async () => {
    const name = window.prompt('请输入快照名称（如 baseline_v1）：', '');
    if (name === null) return;
    setIsSnapshotting(true);
    const res = await Bridge.createSnapshot('.', name);
    if (res.ok) {
      alert(`已成功创建数据库与环境快照：${res.data}`);
    } else {
      alert(`创建快照失败: ${res.error?.plain_message || res.error?.message}`);
    }
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
    <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
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
              <span>Web 实时预览</span>
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
              <span>后端脚本测试台</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'web' && (
            <>
              <button
                onClick={openLanModal}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1a2130] hover:bg-[#232b3d] text-cyan-300 hover:text-white rounded-md text-xs font-medium border border-cyan-800/40 transition"
                title="局域网真机扫码预览"
              >
                <QrCode size={13} className="text-cyan-400" />
                <span>局域网真机预览</span>
              </button>

              <button
                onClick={handleCreateSnapshot}
                disabled={isSnapshotting}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1a2130] hover:bg-[#232b3d] text-slate-300 hover:text-white rounded-md text-xs font-medium border border-[#2d374d] transition"
                title="保存数据库与环境快照"
              >
                <Camera size={13} className="text-amber-400" />
                <span>{isSnapshotting ? '正在生成快照...' : '保存环境快照'}</span>
              </button>

              <button
                onClick={handleTriggerWebIssue}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-medium shadow-md shadow-rose-950/30 transition animate-bounce"
              >
                <Bug size={13} />
                <span>反馈问题 / 提 Issue</span>
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
              <button className="p-1 hover:bg-[#232938] rounded text-slate-400 hover:text-slate-200 transition">
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
                title="在系统浏览器打开"
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
                <h3 className="text-base font-semibold text-slate-100 mb-1">{project.name} Web 预览</h3>
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
                  测试出现问题？点此反馈（自动附带报错探针日志）
                </button>
              </div>
            </div>
          </div>

          {/* Right Acceptance Checklist Panel */}
          <div className="w-80 bg-[#12151d] p-4 flex flex-col">
            <h4 className="text-xs font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-amber-400" />
              <span>当前任务白话验收清单</span>
            </h4>

            {testingCard ? (
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="p-2.5 bg-[#181d2a] rounded-lg border border-[#232a3a] text-xs text-slate-300">
                  <div className="text-[10px] text-amber-400 font-medium mb-1">
                    任务: {testingCard.title}
                  </div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">
                    {testingCard.summary_plain || 'AI 助手已提交提测，请根据以下步骤验收。'}
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
                        {step.checked ? <CheckSquare size={14} /> : <Square size={14} className="text-slate-500" />}
                      </button>
                      <div className="flex-1 text-xs">
                        <div className="font-medium mb-0.5">
                          第 {step.step} 步: {step.action}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          预期结果: {step.expected}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-10">
                当前暂无处于“待我测试”状态的任务卡片
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
              可用任务列表 (devos.run.json)
            </span>
            <div className="space-y-1">
              {targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTargetId(t.id);
                    const init: Record<string, any> = {};
                    t.inputs.forEach((i) => {
                      init[i.name] = i.default ?? '';
                    });
                    setFormInputs(init);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition text-xs ${
                    selectedTargetId === t.id
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                      : 'bg-[#151924] border-[#202636] text-slate-300 hover:border-[#2f384e]'
                  }`}
                >
                  <div className="font-medium text-slate-100">{t.label}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</div>
                </button>
              ))}

              {targets.length === 0 && (
                <div className="text-xs text-slate-500 p-4 text-center">
                  未声明可测试的任务
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
                  >
                    <Play size={13} />
                    <span>{isRunning ? '正在容器沙盒中执行测试...' : '运行测试'}</span>
                  </button>
                </div>

                {/* Execution Result Box */}
                {lastScriptResult && (
                  <div className="bg-[#141824] p-5 rounded-xl border border-[#22293a] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">执行结果</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          耗时: {lastScriptResult.duration_ms}ms
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            lastScriptResult.exit_code === 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          退出码: {lastScriptResult.exit_code}
                        </span>
                      </div>
                    </div>

                    {lastScriptResult.stderr_tail && (
                      <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-300 font-mono text-xs whitespace-pre-wrap">
                        {lastScriptResult.stderr_tail}
                      </div>
                    )}

                    {lastScriptResult.stdout_tail && (
                      <div className="p-3 bg-[#0d1017] border border-[#232938] rounded-lg text-slate-300 font-mono text-xs whitespace-pre-wrap">
                        {lastScriptResult.stdout_tail}
                      </div>
                    )}

                    {lastScriptResult.exit_code !== 0 && (
                      <button
                        onClick={() =>
                          onOpenCreateIssue({
                            source_type: 'script_run',
                            script: lastScriptResult,
                            title: `脚本 ${currentTarget.label} 执行失败`,
                            description: `执行命令失败并返回退出码 ${lastScriptResult.exit_code}`,
                          })
                        }
                        className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Bug size={13} />
                        <span>结果异常？一键转为 Issue 通知 AI 修复</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-20">
                请从左侧选择一个要测试的任务
              </div>
            )}
          </div>
        </div>
      )}

      {/* LAN Preview & QR Code Modal */}
      {isLanModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141824] border border-[#222938] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setIsLanModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
            >
              <X size={16} />
            </button>

            <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-3">
              <Smartphone size={20} />
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-1">局域网真机扫码预览</h3>
            <p className="text-xs text-slate-400 mb-4">
              确保手机与电脑连接同一 Wi-Fi，打开微信或系统相机即可扫码直接测试页面。
            </p>

            {qrDataUrl ? (
              <div className="bg-white p-3 rounded-xl inline-block shadow-lg mb-4">
                <img src={qrDataUrl} alt="LAN QR Code" className="w-44 h-44 object-contain mx-auto" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-[#0f1118] border border-dashed border-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4 text-xs text-slate-500">
                生成二维码中...
              </div>
            )}

            <div className="flex items-center gap-2 bg-[#0d1017] border border-[#222938] rounded-lg p-2 text-xs mb-4">
              <span className="text-slate-400 font-mono text-[11px] truncate flex-1">{lanUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lanUrl);
                  setIsCopiedLan(true);
                  setTimeout(() => setIsCopiedLan(false), 2000);
                }}
                className="p-1.5 hover:bg-[#202636] rounded text-slate-300 transition"
                title="复制地址"
              >
                {isCopiedLan ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>

            <button
              onClick={() => setIsLanModalOpen(false)}
              className="w-full py-2 bg-[#1e2433] hover:bg-[#283144] text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
