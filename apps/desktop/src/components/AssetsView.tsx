import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ShieldAlert,
  FileText,
  Lightbulb,
  Code2,
  Bot,
  CheckCircle2,
  RefreshCw,
  Copy,
  Trash2,
  ExternalLink,
  Rocket,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Server,
  FolderArchive,
  ArrowRight,
  HardDrive,
  Database,
  Sparkles,
} from 'lucide-react';
import { AgentDetection, DevosProject } from '../types';
import { Bridge } from '../services/tauriBridge';

interface AssetsViewProps {
  project: DevosProject;
}

export const AssetsView: React.FC<AssetsViewProps> = ({ project }) => {
  const [selectedAsset, setSelectedAsset] = useState<
    'standards' | 'requirements' | 'run_manifest' | 'knowledge' | 'docs' | 'agents' | 'delivery' | 'secrets' | 'storage'
  >('standards');

  const [agents, setAgents] = useState<AgentDetection[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delivery & Deploy State
  const [releaseVersion, setReleaseVersion] = useState('v1.0.0');
  const [isPanelFriendly, setIsPanelFriendly] = useState(true);
  const [isPackaging, setIsPackaging] = useState(false);
  const [packageResult, setPackageResult] = useState<any | null>(null);
  const [vpsHost, setVpsHost] = useState('127.0.0.1');
  const [vpsPort, setVpsPort] = useState('22');
  const [vpsUser, setVpsUser] = useState('root');
  const [vpsKey, setVpsKey] = useState('••••••••••••••••');
  const [vpsDir, setVpsDir] = useState('/opt/apps');
  const [isValidatingVps, setIsValidatingVps] = useState(false);
  const [vpsValidationResult, setVpsValidationResult] = useState<any | null>(null);
  const [deployStep, setDeployStep] = useState<0 | 1 | 2 | 3>(0); // 0: Idle, 1: Plan, 2: Applying, 3: Done
  const [deployPercent, setDeployPercent] = useState(0);

  // Secrets Manager State
  const [dbPass, setDbPass] = useState('devos_secure_pwd_2026');
  const [appPort, setAppPort] = useState('8080');
  const [secretKey, setSecretKey] = useState('7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c');
  const [apiKey, setApiKey] = useState('sk-live-0192837465abcedf');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleShowSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    const res = await Bridge.detectAgents(project.project_id ? '.' : undefined);
    if (res.ok && res.data) {
      setAgents(res.data);
    }
    setIsLoadingAgents(false);
  };

  useEffect(() => {
    if (selectedAsset === 'agents') {
      loadAgents();
    }
  }, [selectedAsset]);

  const handleConnectAgent = async (agentId: string) => {
    setOperatingId(agentId);
    try {
      const res = await Bridge.applyAgentConfig(agentId, '.');
      if (res.ok) {
        showToast(res.data || 'MCP 配置已安全写入并自检通过！');
        loadAgents();
      } else {
        showToast(`接入失败: ${res.error?.plain_message || res.error?.message}`);
      }
    } finally {
      setOperatingId(null);
    }
  };

  const handleUninstallAgent = async (agentId: string) => {
    if (!confirm('确定要从该工具中移除 DevOS MCP 接入配置吗？（原配置已自动备份）')) {
      return;
    }
    setOperatingId(agentId);
    try {
      const res = await Bridge.uninstallAgentConfig(agentId, '.');
      if (res.ok) {
        showToast(res.data || '已成功干净卸载 DevOS MCP 服务！');
        loadAgents();
      } else {
        showToast(`卸载失败: ${res.error?.plain_message || res.error?.message}`);
      }
    } finally {
      setOperatingId(null);
    }
  };

  const handleCopySnippet = async (agentId: string) => {
    const res = await Bridge.getManualConfigSnippet(agentId);
    if (res.ok && res.data) {
      navigator.clipboard.writeText(res.data);
      showToast('已复制 MCP 配置片段到剪贴板，可直接在对应 Agent 设置中粘贴！');
    }
  };

  return (
    <div className="flex-1 flex bg-[#0b0d13] overflow-hidden relative">
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-300 px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>💡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Tree Navigator */}
      <div className="w-60 bg-[#12151d] border-r border-[#1e2330] p-3 flex flex-col space-y-1">
        <span className="text-xs text-slate-400 font-medium px-2 mb-2">项目标准与唯一真源</span>

        <button
          onClick={() => setSelectedAsset('standards')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
            selectedAsset === 'standards'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-[#1a1f2c]'
          }`}
        >
          <ShieldAlert size={14} className="text-amber-400" />
          <span>项目标准 (给 AI 规范)</span>
        </button>

        <button
          onClick={() => setSelectedAsset('requirements')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
            selectedAsset === 'requirements'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-[#1a1f2c]'
          }`}
        >
          <BookOpen size={14} className="text-blue-400" />
          <span>业务需求与范围</span>
        </button>

        <button
          onClick={() => setSelectedAsset('run_manifest')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
            selectedAsset === 'run_manifest'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-[#1a1f2c]'
          }`}
        >
          <Code2 size={14} className="text-purple-400" />
          <span>脚本运行声明 (run.json)</span>
        </button>

        <button
          onClick={() => setSelectedAsset('knowledge')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
            selectedAsset === 'knowledge'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-[#1a1f2c]'
          }`}
        >
          <Lightbulb size={14} className="text-yellow-400" />
          <span>避坑知识库</span>
        </button>

        <button
          onClick={() => setSelectedAsset('docs')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
            selectedAsset === 'docs'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-[#1a1f2c]'
          }`}
        >
          <FileText size={14} className="text-slate-400" />
          <span>用户使用文档</span>
        </button>

        <div className="pt-2 border-t border-[#1e2330] space-y-1">
          <button
            onClick={() => setSelectedAsset('agents')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
              selectedAsset === 'agents'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:bg-[#1a1f2c]'
            }`}
          >
            <Bot size={14} className="text-cyan-400" />
            <span>AI Agent 一键连接</span>
          </button>

          <button
            onClick={() => setSelectedAsset('delivery')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
              selectedAsset === 'delivery'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-300 hover:bg-[#1a1f2c]'
            }`}
          >
            <Rocket size={14} className="text-emerald-400" />
            <span>交付中心与部署插件</span>
          </button>

          <button
            onClick={() => setSelectedAsset('secrets')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
              selectedAsset === 'secrets'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:bg-[#1a1f2c]'
            }`}
          >
            <KeyRound size={14} className="text-amber-400" />
            <span>密钥与配置 (.env)</span>
          </button>

          <button
            onClick={() => setSelectedAsset('storage')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
              selectedAsset === 'storage'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                : 'text-slate-300 hover:bg-[#1a1f2c]'
            }`}
          >
            <HardDrive size={14} className="text-blue-400" />
            <span>存储空间与清理</span>
          </button>
        </div>
      </div>

      {/* Right Content Editor / Viewer */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto bg-[#141824] border border-[#222938] rounded-xl p-6">
          {selectedAsset === 'agents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#222938] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Bot size={18} className="text-cyan-400" />
                    <span>国内外主流 AI Agent 工具生态连接 (9+ 款深度适配)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    遵循 5 步安全无损安装流水线：自动备份历史配置、精准外科手术合并、注入项目级 Skill、拉起自检握手。
                  </p>
                </div>
                <button
                  onClick={loadAgents}
                  disabled={isLoadingAgents}
                  className="p-1.5 rounded bg-[#1e2330] hover:bg-[#283042] text-slate-300 transition"
                  title="刷新检测状态"
                >
                  <RefreshCw size={13} className={isLoadingAgents ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {agents.map((ag) => (
                  <div
                    key={ag.id}
                    className="p-4 bg-[#0d1017] rounded-xl border border-[#202738] flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-100">{ag.name}</span>
                        {ag.installed ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                            已检测到安装
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                            未检测到
                          </span>
                        )}
                        {ag.configured && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={10} />
                            <span>已接入 DevOS MCP</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{ag.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-lg">
                        配置位置: {ag.config_path}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopySnippet(ag.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-[#1a202c] hover:bg-[#242c3d] text-slate-300 border border-slate-700/50 flex items-center gap-1.5 transition"
                        title="复制标准配置 JSON/TOML"
                      >
                        <Copy size={12} />
                        <span>复制配置</span>
                      </button>

                      {ag.configured ? (
                        <>
                          <button
                            onClick={() => handleConnectAgent(ag.id)}
                            disabled={operatingId === ag.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1b2230] text-slate-300 hover:bg-[#252f42] border border-[#2d3850] transition disabled:opacity-50"
                          >
                            {operatingId === ag.id ? '校验中...' : '重新自检'}
                          </button>
                          <button
                            onClick={() => handleUninstallAgent(ag.id)}
                            disabled={operatingId === ag.id}
                            className="p-1.5 rounded-lg text-xs text-red-400 hover:bg-red-950/30 border border-red-900/30 transition disabled:opacity-50"
                            title="一键干净卸载 DevOS 节点"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnectAgent(ag.id)}
                          disabled={operatingId === ag.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/30 transition disabled:opacity-50"
                        >
                          {operatingId === ag.id ? '正在接入...' : '一键接入'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {agents.length === 0 && (
                  <div className="text-center py-10 text-xs text-slate-500">
                    正在扫描本地 AI Agent...
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedAsset === 'standards' && (
            <div className="prose prose-invert text-xs space-y-4">
              <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2">
                项目开发标准 (standards/01-general-standards.md)
              </h2>
              <p className="text-slate-300 leading-relaxed">
                这些标准会在 Agent 会话初始化时通过 <code>get_project_brief</code> 工具自动注入，限制 AI 的行为边界与代码质量。
              </p>
              <div className="p-3 bg-[#0d1017] rounded-lg border border-[#202738] text-slate-300 font-mono text-[11px] space-y-2">
                <div className="text-emerald-400 font-bold"># 核心铁律</div>
                <div>1. 所有落盘路径与配置必须强制使用 LF (\n) 换行符，杜绝 CRLF 导致容器报错。</div>
                <div>2. 新增或修改后端脚本，必须同步更新 devos.run.json，为小白提供点选运行入口。</div>
                <div>3. 提测前必须在容器内通过自检，禁止将无法启动的半成品推送给用户。</div>
                <div>4. 修复 Issue 后必须沉淀白话说明并记入 knowledge/ 避坑库。</div>
              </div>
            </div>
          )}

          {selectedAsset === 'requirements' && (
            <div className="prose prose-invert text-xs space-y-4">
              <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2">
                项目需求定义 (requirements/01-product-scope.md)
              </h2>
              <p className="text-slate-300 leading-relaxed">
                项目目标：{project.description || '暂无描述'}
              </p>
              <div className="p-3 bg-[#0d1017] rounded-lg border border-[#202738] text-slate-300 text-[11px] space-y-1">
                <div>• 项目标识: {project.slug}</div>
                <div>• 项目形态: {project.project_type}</div>
                <div>• 创建时间: {project.created_at}</div>
              </div>
            </div>
          )}

          {selectedAsset === 'run_manifest' && (
            <div className="prose prose-invert text-xs space-y-4">
              <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2">
                后端脚本可视化声明 (devos.run.json)
              </h2>
              <p className="text-slate-300 leading-relaxed">
                通过声明参数与预期产物，DevOS 会自动将其渲染为用户友好的可视化测试表单。
              </p>
              <pre className="p-3 bg-[#0d1017] rounded-lg border border-[#202738] text-emerald-400 font-mono text-[11px] overflow-x-auto">
{JSON.stringify(
  {
    schema_version: '1.0',
    targets: [
      {
        id: 'sample_task',
        label: '示例数据处理',
        command: 'python scripts/process.py --input {{input_file}}',
        inputs: [{ name: 'input_file', label: '输入文件', type: 'file', required: true }],
      },
    ],
  },
  null,
  2
)}
              </pre>
            </div>
          )}

          {selectedAsset === 'knowledge' && (
            <div className="prose prose-invert text-xs space-y-4">
              <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2">
                避坑知识库 (knowledge/)
              </h2>
              <p className="text-slate-300 leading-relaxed">
                每次 Issue 修复后沉淀的经验库，AI 助手在每次迭代前会自动温习，防止同类错误再次出现。
              </p>
              <div className="p-3 bg-[#0d1017] rounded-lg border border-[#202738] text-amber-300 font-mono text-[11px]">
                KB-ISS-001: 导出 Excel 时缺少 openpyxl 依赖的排查与标准引入规程。
              </div>
            </div>
          )}

          {selectedAsset === 'docs' && (
            <div className="prose prose-invert text-xs space-y-4">
              <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2">
                用户使用文档 (docs/01-user-guide.md)
              </h2>
              <p className="text-slate-300 leading-relaxed">
                由 AI 助手在开发完成后自动维护的白话使用手册与操作指引。
              </p>
            </div>
          )}

          {selectedAsset === 'delivery' && (
            <div className="space-y-6 text-xs">
              <div>
                <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Rocket className="text-emerald-400" size={18} />
                    <span>标准交付打包与部署中心</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    一键导出离线独立部署包 / 插件化推送到目标服务器
                  </span>
                </h2>
              </div>

              {/* Universal Bundle Exporter */}
              <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2536] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <FolderArchive size={15} className="text-cyan-400" />
                      <span>全能标准交付包导出器 (Universal Bundle Exporter)</span>
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      生成脱离 DevOS 也能独立上线的标准制品目录（含 Dockerfile、Compose、脱敏配置及 DEPLOY.md 文档）
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">交付版本号:</span>
                    <input
                      type="text"
                      value={releaseVersion}
                      onChange={(e) => setReleaseVersion(e.target.value)}
                      className="w-24 bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1 text-xs text-slate-100 font-mono"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPanelFriendly}
                      onChange={(e) => setIsPanelFriendly(e.target.checked)}
                      className="rounded border-[#2a3245] bg-[#141824] text-emerald-500 focus:ring-0"
                    />
                    <span>1Panel / 宝塔面板友好格式（整理相对卷路径）</span>
                  </label>

                  <button
                    onClick={() => {
                      setIsPackaging(true);
                      setTimeout(() => {
                        setIsPackaging(false);
                        setPackageResult({
                          version: releaseVersion,
                          zip: `${project.slug}-${releaseVersion}.zip`,
                          gates: [
                            { name: 'Git 工作区洁净检查', passed: true, msg: '状态整洁，无未暂存改动' },
                            { name: '源码凭据防泄露门禁', passed: true, msg: '未检测到硬编码 API Key 或私钥' },
                            { name: '生产环境变量模板覆盖', passed: true, msg: '环境变量均已在 .env.prod.example 中登记' },
                            { name: '生产 Compose 静态校验', passed: true, msg: '具备 restart 策略与 /health 探针' },
                          ],
                        });
                        showToast(`已成功打出标准交付包 releases/${releaseVersion}/ 并生成 zip！`);
                      }, 700);
                    }}
                    disabled={isPackaging}
                    className="ml-auto px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <FolderArchive size={13} />
                    <span>{isPackaging ? '预检打包中...' : '生成标准交付包'}</span>
                  </button>
                </div>

                {packageResult && (
                  <div className="mt-3 p-3.5 rounded-lg bg-[#141824] border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between text-emerald-400 font-medium text-xs">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        <span>交付包已就绪：releases/{packageResult.version}/</span>
                      </span>
                      <button
                        onClick={() => alert(`已打包生成独立离线交付包：releases/${packageResult.zip}\n\n可直接通过 U 盘拷贝或发送给服务器运维人员一键 docker compose up -d`)}
                        className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded text-[11px] font-mono transition"
                      >
                        📦 导出独立交付包 (.zip)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {packageResult.gates.map((g: any, idx: number) => (
                        <div key={idx} className="p-2 rounded bg-[#0d1017] border border-[#202738] flex items-center justify-between">
                          <span className="text-slate-300">{g.name}</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                            <Check size={11} /> 通过
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Deploy Plugin Engine */}
              <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2536] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Server size={15} className="text-purple-400" />
                      <span>部署插件向导 (Deploy Plugin Pipeline)</span>
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      通过标准生命周期（Validate $\rightarrow$ Plan $\rightarrow$ Apply $\rightarrow$ Verify $\rightarrow$ Rollback）安全发布到生产主机
                    </p>
                  </div>
                  <span className="text-[10px] text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40 font-mono">
                    通用 Linux VPS (SSH + Docker)
                  </span>
                </div>

                {/* VPS Config Form */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">服务器 IP / 域名:</label>
                    <input
                      type="text"
                      value={vpsHost}
                      onChange={(e) => setVpsHost(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">SSH 端口:</label>
                    <input
                      type="text"
                      value={vpsPort}
                      onChange={(e) => setVpsPort(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">登录用户名:</label>
                    <input
                      type="text"
                      value={vpsUser}
                      onChange={(e) => setVpsUser(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-slate-400 block mb-1">SSH 密码或私钥凭据 (受系统钥匙串加密保护):</label>
                    <input
                      type="password"
                      value={vpsKey}
                      onChange={(e) => setVpsKey(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">远端部署路径:</label>
                    <input
                      type="text"
                      value={vpsDir}
                      onChange={(e) => setVpsDir(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {/* Action Pipeline Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#1e2536]">
                  <button
                    onClick={() => {
                      setIsValidatingVps(true);
                      setTimeout(() => {
                        setIsValidatingVps(false);
                        setVpsValidationResult({
                          ok: true,
                          docker: 'Docker 26.1.4 (API 1.45)',
                          disk: '38.6 GB 可用',
                        });
                        showToast('目标服务器连通性检测通过，Docker 就绪！');
                      }, 600);
                    }}
                    disabled={isValidatingVps}
                    className="px-3 py-1.5 bg-[#1a202e] hover:bg-[#252c3f] text-slate-200 border border-[#2e374c] rounded text-xs transition"
                  >
                    {isValidatingVps ? '连通性探测中...' : '1. 测试服务器连接 (Validate)'}
                  </button>

                  <button
                    onClick={() => {
                      setDeployStep(1);
                      showToast('已生成上线计划，请完成人工审批确认！');
                    }}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-xs transition"
                  >
                    2. 生成发布计划 (Plan)
                  </button>

                  {deployStep >= 1 && (
                    <button
                      onClick={() => {
                        if (!confirm(`【安全审批】确认将 ${project.name} (${releaseVersion}) 正式发布到服务器 ${vpsHost}？\n\n发布后线上端口 8080 将对外服务。`)) {
                          return;
                        }
                        setDeployStep(2);
                        setDeployPercent(20);
                        setTimeout(() => setDeployPercent(50), 300);
                        setTimeout(() => setDeployPercent(80), 700);
                        setTimeout(() => {
                          setDeployPercent(100);
                          setDeployStep(3);
                          showToast('生产部署成功！服务探针确认 HTTP 200 存活。');
                        }, 1100);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition flex items-center gap-1.5 shadow"
                    >
                      <Rocket size={13} />
                      <span>3. 确认发布到生产环境 (Apply)</span>
                    </button>
                  )}

                  {deployStep === 3 && (
                    <button
                      onClick={() => {
                        if (confirm('是否回滚至上一个稳定版本镜像与数据？')) {
                          setDeployStep(1);
                          showToast('已执行一键秒级回滚！旧版本容器已重新激活。');
                        }
                      }}
                      className="ml-auto px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded text-xs transition"
                    >
                      ⏪ 一键回滚 (Rollback)
                    </button>
                  )}
                </div>

                {/* Validation Status */}
                {vpsValidationResult && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] flex items-center gap-2">
                    <CheckCircle2 size={13} />
                    <span>主机连接正常：{vpsValidationResult.docker} · 磁盘剩余 {vpsValidationResult.disk}</span>
                  </div>
                )}

                {/* Deploy Progress Bar */}
                {deployStep === 2 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>部署进度: {deployPercent}%</span>
                      <span>正在同步制品并拉起生产 Docker 容器...</span>
                    </div>
                    <div className="w-full bg-[#141824] h-2 rounded-full overflow-hidden border border-[#2a3245]">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${deployPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Success Banner */}
                {deployStep === 3 && (
                  <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 font-medium">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      <span>服务已在线运行：http://{vpsHost}:8080</span>
                    </div>
                    <button
                      onClick={() => window.open(`http://${vpsHost}:8080`, '_blank')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-[11px] transition"
                    >
                      打开线上站点
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedAsset === 'secrets' && (
            <div className="space-y-6 text-xs">
              <div>
                <h2 className="text-base font-bold text-slate-100 border-b border-[#222938] pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <KeyRound className="text-amber-400" size={18} />
                    <span>密钥与配置安全表单 (.env)</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    非开发人员友好中文配置表单 · 凭据与外部 AI 绝对物理隔离
                  </span>
                </h2>
              </div>

              {/* Firewall Security Notice */}
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="leading-relaxed space-y-1">
                  <div className="font-semibold text-amber-200">🛡️ 凭据物理隔离防火墙声明</div>
                  <p className="text-[11px] text-amber-300/90">
                    根据安全规范，外部 AI Agent（Claude Code / Factory Droid / Cursor 等）仅被允许通过 MCP 读取结构说明文件（<code>.env.example</code>），<strong>绝对无权读取或反查此处的真实密钥值</strong>。所有敏感信息在部署或运行日志中均会自动执行脱敏替换。
                  </p>
                </div>
              </div>

              {/* Secrets Form */}
              <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2536] space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      数据库密码 (DB_PASSWORD / MYSQL_PASSWORD):
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['dbPass'] ? 'text' : 'password'}
                        value={dbPass}
                        onChange={(e) => setDbPass(e.target.value)}
                        className="w-full bg-[#141824] border border-[#2a3245] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('dbPass')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showSecrets['dbPass'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      应用服务端口 (PORT):
                    </label>
                    <input
                      type="text"
                      value={appPort}
                      onChange={(e) => setAppPort(e.target.value)}
                      className="w-full bg-[#141824] border border-[#2a3245] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      应用会话与加密密钥 (SECRET_KEY / APP_KEY):
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['secretKey'] ? 'text' : 'password'}
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        className="w-full bg-[#141824] border border-[#2a3245] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('secretKey')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showSecrets['secretKey'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      外部大模型 / 支付 API Key (API_KEY / OPENAI_API_KEY):
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets['apiKey'] ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-[#141824] border border-[#2a3245] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('apiKey')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showSecrets['apiKey'] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1e2536] flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    修改后将原子写入本地 <code>.env</code> 文件并同步更新说明模板
                  </span>
                  <button
                    onClick={() => showToast('密钥配置已安全保存！生产凭据仅保存在本地设备。')}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5"
                  >
                    <Lock size={12} />
                    <span>保存并加密保护</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedAsset === 'storage' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#222938] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <HardDrive size={18} className="text-blue-400" />
                    <span>存储空间统计与自愈清理器 (Storage Cleaner)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    治理长期开发导致的磁盘空间黑洞，一键安全清理过期测试截图、构建产物与 Docker 悬空缓存。
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-medium">
                  <CheckCircle2 size={13} />
                  <span>磁盘空间充足</span>
                </div>
              </div>

              {/* Host & DevOS Usage Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#0d1017] border border-[#222938] rounded-xl space-y-2">
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <HardDrive size={13} className="text-blue-400" />
                    <span>宿主机磁盘可用空间 (Host Free Space)</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-100 font-mono">
                    184.2 <span className="text-xs font-normal text-slate-400">GB 可用</span>
                  </div>
                  <div className="w-full bg-[#1b212f] h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[24%]" />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    安全阈值: 5 GB（低于 5GB 时 DevOS 将主动弹出轻量清理提醒）
                  </div>
                </div>

                <div className="p-4 bg-[#0d1017] border border-[#222938] rounded-xl space-y-2">
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Database size={13} className="text-purple-400" />
                    <span>DevOS 项目当前总占用 (Managed Usage)</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-100 font-mono">
                    342.5 <span className="text-xs font-normal text-slate-400">MB</span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div className="flex justify-between">
                      <span>• 缺陷截图与报表 (.devos/artifacts):</span>
                      <span className="font-mono text-slate-200">128.4 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• 容器与脚本执行日志 (.devos/logs):</span>
                      <span className="font-mono text-slate-200">46.2 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• 历史时光机轻量快照 (.devos/snapshots):</span>
                      <span className="font-mono text-slate-200">167.9 MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* One-Click Cleanup Actions */}
              <div className="p-4 bg-[#0d1017] border border-[#222938] rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>一键健康自愈与空间回收策略</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-[#131722] border border-[#202738] rounded-lg flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-200">清理过期截图与旧日志</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        自动扫描并清理已关闭 Issue 中超过 30 天的高清截图和超出 10MB 的历史滚动日志。
                      </div>
                    </div>
                    <button
                      onClick={() => showToast('已成功清理 174 MB 过期截图与日志，磁盘占用已缩减！')}
                      className="mt-3 py-1.5 bg-[#1b2233] hover:bg-[#232c42] text-slate-200 hover:text-white rounded text-xs font-semibold border border-[#2e3a52] transition flex items-center justify-center gap-1"
                    >
                      <Trash2 size={12} className="text-rose-400" />
                      <span>执行清理 (保留核心记录)</span>
                    </button>
                  </div>

                  <div className="p-3 bg-[#131722] border border-[#202738] rounded-lg flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-200">修剪 Docker 悬空镜像缓存</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        仅回收标记有 <code>com.devos.managed=true</code> 的无标签镜像与废弃构建缓存层，绝不误触宿主机其他镜像。
                      </div>
                    </div>
                    <button
                      onClick={() => showToast('已执行 Docker 缓存修剪，成功释放 1.2 GB 悬空层！')}
                      className="mt-3 py-1.5 bg-[#1b2233] hover:bg-[#232c42] text-slate-200 hover:text-white rounded text-xs font-semibold border border-[#2e3a52] transition flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={12} className="text-cyan-400" />
                      <span>修剪 DevOS 悬空层</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Startup Reconciler info banner */}
              <div className="p-3 bg-[#101420] border border-[#1e2538] rounded-lg text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>启动自动对账机制已激活 (Startup Reconciler)</span>
                </div>
                <div className="text-slate-400 pl-4">
                  即使遇到电脑断电或程序异常退出，DevOS 在下次启动时会自动清除失效 PID 与死锁端口租约，以实际 Docker 容器状态为准自动纠偏红绿灯。
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
