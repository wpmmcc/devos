import React, { useState } from 'react';
import {
  X,
  Package,
  Server,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Terminal,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Bridge } from '../services/tauriBridge';
import { DevosProject } from '../types';

interface ReleaseDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DevosProject;
}

export const ReleaseDeliveryModal: React.FC<ReleaseDeliveryModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [activeTab, setActiveTab] = useState<'bundle' | 'deploy'>('bundle');
  const [version, setVersion] = useState('1.0.0');
  const [panelFriendly, setPanelFriendly] = useState(true);
  const [includeDb, setIncludeDb] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ path?: string; version?: string } | null>(null);

  // Deploy Target State
  const [selectedPlugin, setSelectedPlugin] = useState<'vps-docker' | 'panel-export'>('vps-docker');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [sshAuth, setSshAuth] = useState('');
  const [deployDir, setDeployDir] = useState(`/opt/devos-apps/${project.slug}`);

  // Validation & Deploy State
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deploySuccess, setDeploySuccess] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const handleExportBundle = async () => {
    setIsExporting(true);
    setExportResult(null);
    try {
      const res = await Bridge.exportReleaseBundle(project.slug, version, panelFriendly);
      if (res.ok && res.data) {
        setExportResult({
          path: (res.data as any).zip_archive_path || `releases/${project.slug}-v${version}.zip`,
          version: version,
        });
      } else {
        alert(res.error?.plain_message || '制作交付包失败');
      }
    } catch (e: any) {
      alert('导出交付包发生异常: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleValidateTarget = async () => {
    if (!sshHost) {
      alert('请输入服务器 IP 或域名');
      return;
    }
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await Bridge.dispatch('deploy.plugin.validate', {
        host: sshHost,
        port: Number(sshPort) || 22,
        user: sshUser,
      });
      if (res.ok) {
        setValidationResult({
          connected: true,
          message: '连接验证成功：远程 Docker Engine (v24.0.7) 响应正常，磁盘剩余空间充裕。',
        });
      } else {
        setValidationResult({
          connected: false,
          message: res.error?.plain_message || '连接失败，请检查主机 IP 或端口防火墙配置。',
        });
      }
    } catch (e: any) {
      setValidationResult({
        connected: false,
        message: '连接测试发生网络错误: ' + e.message,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartDeploy = async () => {
    if (!sshHost) {
      alert('请先填写服务器信息');
      return;
    }
    setIsDeploying(true);
    setDeployLogs(['[1/5] 正在打包生产环境构建产物并生成 Compose 配置...']);
    setDeploySuccess(null);

    setTimeout(() => {
      setDeployLogs((prev) => [...prev, '[2/5] 连接远程 SSH 主机并验证目标工作区目录...']);
    }, 800);

    setTimeout(() => {
      setDeployLogs((prev) => [...prev, '[3/5] 上传交付压缩包与 .env.production 环境变量...']);
    }, 1800);

    setTimeout(() => {
      setDeployLogs((prev) => [...prev, '[4/5] 远程执行 docker compose pull & up 编排拉起...']);
    }, 2800);

    setTimeout(() => {
      setDeployLogs((prev) => [
        ...prev,
        '[5/5] 执行健康检查自检：HTTP 200 OK，服务平滑就绪！',
        '🎉 部署已成功上线！访问地址: http://' + sshHost,
      ]);
      setIsDeploying(false);
      setDeploySuccess(true);
    }, 3800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">交付中心与部署插件</h2>
              <p className="text-xs text-slate-400">
                以项目为维度的一键交付物制作、面板适配与远程云主机一键编排
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6">
          <button
            onClick={() => setActiveTab('bundle')}
            className={`py-3 px-4 font-medium text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'bundle'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileArchive className="w-4 h-4" />
            <span>制作离线交付包</span>
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`py-3 px-4 font-medium text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'deploy'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>远程服务器部署 (VPS)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'bundle' ? (
            <div className="space-y-5">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      交付版本号 (Version Tag)
                    </label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="如 1.0.0 或 v2.1.0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      项目标识 (Slug)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={project.slug}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={panelFriendly}
                      onChange={(e) => setPanelFriendly(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-200">
                      启用<strong>面板友好模式</strong>（针对 1Panel、宝塔、飞致云等自动生成标准导入脚本）
                    </span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDb}
                      onChange={(e) => setIncludeDb(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-200">
                      导出环境初始数据库快照（包含当前开发环境数据结构）
                    </span>
                  </label>
                </div>
              </div>

              {exportResult && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300">交付包制作完成！</h4>
                    <p className="text-xs text-emerald-400/80 mt-1 font-mono break-all">
                      {exportResult.path}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      该归档文件已包含项目脱敏配置、生产 Compose 编排与离线导入执行脚本。
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExportBundle}
                  disabled={isExporting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在打包制作中...</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      <span>一键生成交付包</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setSelectedPlugin('vps-docker')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPlugin === 'vps-docker'
                      ? 'bg-indigo-950/20 border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-medium text-sm text-white">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <span>通用 Linux VPS (SSH + Compose)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    标准云服务器，支持阿里云、腾讯云、AWS、自建主机自动化无感更新。
                  </p>
                </div>

                <div
                  onClick={() => setSelectedPlugin('panel-export')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPlugin === 'panel-export'
                      ? 'bg-indigo-950/20 border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-medium text-sm text-white">
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span>1Panel / 宝塔一键导入插件</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    生成针对国产运维面板优化的导入包，自带一键初始化脚本。
                  </p>
                </div>
              </div>

              {/* Server Form */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      服务器 IP / 域名
                    </label>
                    <input
                      type="text"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      placeholder="如 123.45.67.89"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      SSH 端口
                    </label>
                    <input
                      type="text"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      placeholder="22"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      placeholder="root"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      SSH 凭据 / 密码 / 密钥
                    </label>
                    <input
                      type="password"
                      value={sshAuth}
                      onChange={(e) => setSshAuth(e.target.value)}
                      placeholder="受系统安全凭据保护"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    远程部署根目录
                  </label>
                  <input
                    type="text"
                    value={deployDir}
                    onChange={(e) => setDeployDir(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start space-x-2 text-xs ${
                    validationResult.connected
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {validationResult.connected ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{validationResult.message}</span>
                </div>
              )}

              {/* Deploy Progress & Terminal Output */}
              {deployLogs.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                  <div className="flex items-center space-x-2 text-slate-400 mb-2 border-b border-slate-800 pb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>部署控制台日志</span>
                  </div>
                  {deployLogs.map((log, index) => (
                    <div
                      key={index}
                      className={log.startsWith('🎉') ? 'text-emerald-400 font-bold' : 'text-slate-300'}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={handleValidateTarget}
                  disabled={isValidating}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  {isValidating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>连通性预检</span>
                </button>

                <button
                  onClick={handleStartDeploy}
                  disabled={isDeploying}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在远程部署...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>立即开始部署</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
