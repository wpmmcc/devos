import React, { useState } from 'react';
import { BookOpen, ShieldAlert, FileText, Lightbulb, Code2 } from 'lucide-react';
import { DevosProject } from '../types';

interface AssetsViewProps {
  project: DevosProject;
}

export const AssetsView: React.FC<AssetsViewProps> = ({ project }) => {
  const [selectedAsset, setSelectedAsset] = useState<
    'requirements' | 'standards' | 'docs' | 'knowledge' | 'run_manifest'
  >('standards');

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
      </div>

      {/* Right Content Editor / Viewer */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto bg-[#141824] border border-[#222938] rounded-xl p-6">
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
