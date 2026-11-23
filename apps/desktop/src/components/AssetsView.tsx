import React, { useEffect, useState } from 'react';
import { BookOpen, ShieldAlert, FileText, Lightbulb, Code2, Bot, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AgentDetection, DevosProject } from '../types';
import { Bridge } from '../services/tauriBridge';

interface AssetsViewProps {
  project: DevosProject;
}

export const AssetsView: React.FC<AssetsViewProps> = ({ project }) => {
  const [selectedAsset, setSelectedAsset] = useState<
    'standards' | 'requirements' | 'run_manifest' | 'knowledge' | 'docs' | 'agents'
  >('standards');

  const [agents, setAgents] = useState<AgentDetection[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    const res = await Bridge.detectAgents();
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
    setConfiguringId(agentId);
    const res = await Bridge.applyAgentConfig(agentId);
    if (res.ok) {
      alert(res.data || 'MCP 配置已成功注入！');
      loadAgents();
    } else {
      alert(`连接失败: ${res.error?.plain_message || res.error?.message}`);
    }
    setConfiguringId(null);
  };

  return (
    <div className="flex-1 flex bg-[#0b0d13] overflow-hidden">
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

        <div className="pt-2 border-t border-[#1e2330]">
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
        </div>
      </div>

      {/* Right Content Editor / Viewer */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto bg-[#141824] border border-[#222938] rounded-xl p-6">
          {selectedAsset === 'agents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#222938] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Bot size={18} className="text-cyan-400" />
                    <span>外部 AI Agent 工具一键连接</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    DevOS 自动扫描本地安装的 Agent，一键向其注入 devos-mcp 标准工具链。
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
                    className="p-4 bg-[#0d1017] rounded-xl border border-[#202738] flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">{ag.name}</span>
                        {ag.installed ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            已检测到安装
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                            未安装
                          </span>
                        )}
                        {ag.configured && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
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

                    <button
                      onClick={() => handleConnectAgent(ag.id)}
                      disabled={configuringId === ag.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        ag.configured
                          ? 'bg-[#1b2230] text-slate-300 hover:bg-[#252f42] border border-[#2d3850]'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/30'
                      }`}
                    >
                      {configuringId === ag.id
                        ? '正在配置...'
                        : ag.configured
                        ? '重新同步配置'
                        : '一键连接'}
                    </button>
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
        </div>
      </div>
    </div>
  );
};
