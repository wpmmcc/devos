import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RotateCw, Stethoscope, Zap, Download, Upload, Globe, Sparkles } from 'lucide-react';
import { DiagnosticItem } from '../types';
import { Bridge } from '../services/tauriBridge';

interface PreflightDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreflightDoctorModal: React.FC<PreflightDoctorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<'auto' | 'china_accelerated' | 'official_direct' | 'custom_proxy'>('auto');
  const [racing, setRacing] = useState(false);
  const [raceLatency, setRaceLatency] = useState<number | null>(null);
  const [selectedMirrorUrl, setSelectedMirrorUrl] = useState<string | null>(null);
  const [importingTool, setImportingTool] = useState<string | null>(null);
  const [importPath, setImportPath] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAutoFixEnvironment = async () => {
    setFixing(true);
    try {
      const res = await Bridge.autoFixEnvironment();
      if (res.ok && res.data) {
        setItems(res.data);
        showToast('环境自愈配置完成！已就绪所有受控依赖');
      } else {
        showToast(`配置完成，部分项需注意: ${res.error?.plain_message || res.error?.message}`);
      }
    } finally {
      setFixing(false);
    }
  };

  const loadDoctor = async () => {
    setLoading(true);
    const res = await Bridge.runDoctor();
    if (res.ok && res.data) {
      setItems(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadDoctor();
    }
  }, [isOpen]);

  const handleRaceMirrors = async () => {
    setRacing(true);
    try {
      const candidates = [
        'https://gh-proxy.com',
        'https://mirror.ghproxy.com',
        'https://registry.npmmirror.com',
        'https://github.com',
      ];
      const res = await Bridge.raceMirrorsSpeed(candidates);
      if (res.ok && res.data) {
        setRaceLatency(res.data.latency_ms);
        setSelectedMirrorUrl(res.data.selected_url);
        showToast(`测速优选完成！最快源延迟: ${res.data.latency_ms}ms (${res.data.selected_url})`);
      }
    } finally {
      setRacing(false);
    }
  };

  const handleImportLocal = async (toolName: string) => {
    if (!importPath.trim()) {
      showToast('请输入本地二进制安装包的完整路径');
      return;
    }
    const res = await Bridge.importLocalToolPackage(toolName, importPath.trim());
    if (res.ok) {
      showToast(`已成功将 ${toolName} 导入到 ~/.devos/bin/`);
      setImportingTool(null);
      setImportPath('');
      loadDoctor();
    } else {
      showToast(`导入失败: ${res.error?.plain_message || res.error?.message}`);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const res = await Bridge.exportDiagnosticBundle('.');
      if (res.ok && res.data) {
        showToast(`已成功导出脱敏诊断包: ${res.data}`);
      } else {
        showToast(`导出失败: ${res.error?.plain_message || res.error?.message}`);
      }
    } catch (e: any) {
      showToast(`导出异常: ${String(e)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#222938] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {toast && (
          <div className="absolute top-4 right-12 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-lg text-xs shadow-lg animate-in fade-in">
            {toast}
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold text-slate-100">环境体检与网络加速向导</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          检查 Docker、DDEV 与网络环境就绪状态；DevOS 支持私有工具链沙盒与国内 4 层下载加速。
        </p>

        {/* 4-tier Network Acceleration Settings */}
        <div className="mb-4 p-3 bg-[#0e1118] border border-[#222938] rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Globe size={13} className="text-cyan-400" />
              <span>国内网络下载加速策略</span>
            </span>
            <button
              onClick={handleRaceMirrors}
              disabled={racing}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/60 transition disabled:opacity-50"
            >
              <Zap size={11} className={racing ? 'animate-bounce' : ''} />
              <span>{racing ? '测速中...' : '2秒并发测速 (Race)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'auto', label: '自动测速择优' },
              { id: 'china_accelerated', label: '中国大陆加速' },
              { id: 'official_direct', label: '官方直连' },
              { id: 'custom_proxy', label: '自定义代理' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setActivePreset(preset.id as any);
                  showToast(`已切换为【${preset.label}】策略`);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition text-center truncate ${
                  activePreset === preset.id
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#151926] text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {raceLatency !== null && selectedMirrorUrl && (
            <div className="text-[11px] text-cyan-400/90 bg-cyan-950/20 px-2 py-1 rounded border border-cyan-900/40">
              ⚡ 最佳镜像源: <span className="font-mono text-slate-300">{selectedMirrorUrl}</span>（延迟: {raceLatency}ms）
            </div>
          )}
        </div>

        {/* Doctor Diagnostic Items List */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
              <RotateCw size={18} className="animate-spin text-emerald-400" />
              <span>正在探测本机容器与命令行状态...</span>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                className="p-3.5 bg-[#0e1118] border border-[#222938] rounded-xl flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {item.status === 'ok' ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : item.status === 'warning' ? (
                    <AlertTriangle size={16} className="text-amber-400" />
                  ) : (
                    <XCircle size={16} className="text-rose-400" />
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{item.title}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                        item.status === 'ok'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : item.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="text-slate-400 mt-0.5 leading-relaxed">{item.message}</div>

                  {item.fix_hint && (
                    <div className="mt-2 p-2 bg-[#171c28] border border-[#262f44] rounded-lg text-amber-300 text-[11px] leading-relaxed">
                      💡 建议: {item.fix_hint}
                    </div>
                  )}

                  {item.status !== 'ok' && (item.key === 'ddev' || item.key === 'devcontainer') && (
                    <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setImportingTool(item.key);
                          setImportPath('');
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                      >
                        <Upload size={11} />
                        <span>已有本地安装包？点此导入</span>
                      </button>
                    </div>
                  )}

                  {importingTool === item.key && (
                    <div className="mt-2 p-2.5 bg-[#151926] rounded-lg border border-cyan-800/40 flex flex-col gap-2">
                      <span className="text-[11px] text-slate-300 font-medium">导入本地已下载好的安装包到 ~/.devos/bin/</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={importPath}
                          onChange={(e) => setImportPath(e.target.value)}
                          placeholder="/path/to/downloaded/binary"
                          className="flex-1 bg-[#0e1118] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => handleImportLocal(item.key)}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition"
                        >
                          确认导入
                        </button>
                        <button
                          onClick={() => setImportingTool(null)}
                          className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#202636]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFixEnvironment}
              disabled={fixing || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition shadow-sm"
              title="自动安装或自愈缺失的环境组件与沙盒工具"
            >
              <Sparkles size={13} className={fixing ? 'animate-spin' : 'text-emerald-400'} />
              <span>{fixing ? '正在自动配置环境...' : '一键环境自愈配置'}</span>
            </button>
            <button
              onClick={loadDoctor}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2330] hover:bg-[#282f42] text-slate-300 transition"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>重新体检</span>
            </button>
            <button
              onClick={handleExportDiagnostics}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-[#1a202c] transition"
              title="一键收集并脱敏导出诊断日志与系统配置"
            >
              <span>📦 导出脱敏诊断包</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
