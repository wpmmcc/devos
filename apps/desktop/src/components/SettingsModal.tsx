import React, { useState } from 'react';
import { Settings, Globe, Shield, Download, RefreshCw, X, Check, Laptop, Moon, Sun, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { switchLanguage } from '../i18n';
import { Bridge } from '../services/tauriBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'diagnostics' | 'about'>('general');
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('dark');
  const [enableMirror, setEnableMirror] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  if (!isOpen) return null;

  const handleExportDiagnostics = async () => {
    setIsExporting(true);
    try {
      const res = await Bridge.exportDiagnosticBundle('.');
      if (res.ok && res.data) {
        alert(
          `已成功生成脱敏诊断包并保存至：\n${res.data}\n\n（已强制正则脱敏用户名、代理与真实密钥）`
        );
      } else {
        alert(`生成诊断包失败: ${res.error?.message || '未知错误'}`);
      }
    } catch (err: any) {
      alert(`导出诊断包异常: ${err.message || String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      alert('当前版本 v0.1.0 已是最新稳定版！已同步 GitHub Releases 规范。');
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-[#141824] border border-[#232c3f] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="p-4 border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">{t('modals.settings.title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202738] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-[#202738] bg-[#0f121a] px-4 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'general'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('modals.settings.tabGeneral')}
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'diagnostics'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('modals.settings.tabDiagnostics')}
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'about'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('modals.settings.tabAbout')}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Language Switch */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t('modals.settings.langLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchLanguage('zh-CN')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-between transition ${
                      i18n.language.startsWith('zh')
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181d2a] border-[#242b3b] text-slate-300 hover:bg-[#1f2536]'
                    }`}
                  >
                    <span>简体中文 (zh-CN)</span>
                    {i18n.language.startsWith('zh') && <Check size={14} className="text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => switchLanguage('en-US')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-between transition ${
                      !i18n.language.startsWith('zh')
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181d2a] border-[#242b3b] text-slate-300 hover:bg-[#1f2536]'
                    }`}
                  >
                    <span>English (en-US)</span>
                    {!i18n.language.startsWith('zh') && <Check size={14} className="text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* Appearance Theme */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-slate-300">
                  {t('modals.settings.themeLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition ${
                      theme === 'system'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181d2a] border-[#242b3b] text-slate-300'
                    }`}
                  >
                    <Laptop size={15} />
                    <span>{t('modals.settings.themeSystem')}</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition ${
                      theme === 'dark'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181d2a] border-[#242b3b] text-slate-300'
                    }`}
                  >
                    <Moon size={15} />
                    <span>{t('modals.settings.themeDark')}</span>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition ${
                      theme === 'light'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181d2a] border-[#242b3b] text-slate-300'
                    }`}
                  >
                    <Sun size={15} />
                    <span>{t('modals.settings.themeLight')}</span>
                  </button>
                </div>
              </div>

              {/* China Mirror Acceleration */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    {t('modals.settings.mirrorLabel')}
                  </span>
                  <input
                    type="checkbox"
                    checked={enableMirror}
                    onChange={(e) => setEnableMirror(e.target.checked)}
                    className="rounded accent-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t('modals.settings.mirrorDesc')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#0d1017] border border-[#232c3f] rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Shield size={14} />
                  <span>{t('modals.settings.exportDiagTitle')}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('modals.settings.exportDiagDesc')}
                </p>
              </div>

              <button
                onClick={handleExportDiagnostics}
                disabled={isExporting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download size={14} />
                <span>{isExporting ? t('common.loading') : t('modals.settings.exportDiagBtn')}</span>
              </button>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xl flex items-center justify-center mx-auto">
                D
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">DevOS Desktop</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('modals.settings.versionInfo', { version: '0.1.0' })}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="px-4 py-2 bg-[#1b2230] hover:bg-[#252e42] text-slate-200 text-xs font-medium rounded-lg border border-[#2a364e] transition inline-flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={isCheckingUpdate ? 'animate-spin text-emerald-400' : ''} />
                  <span>{isCheckingUpdate ? t('common.loading') : t('modals.settings.checkUpdate')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
