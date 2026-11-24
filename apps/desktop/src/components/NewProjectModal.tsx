import React, { useState } from 'react';
import { X, Globe, Terminal, Layers, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectType } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, slug: string, type: ProjectType, description: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation();
  const [projectType, setProjectType] = useState<ProjectType>('hybrid');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const finalSlug = slug.trim() || name.toLowerCase().replace(/\s+/g, '-');
    onCreate(name, finalSlug, projectType, description);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#141824] border border-[#222938] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#202636] transition"
          title="关闭新建向导 (快捷键 Esc)"
        >
          <X size={16} />
        </button>

        <h2 className="text-base font-bold text-slate-100 mb-1">
          {t('modals.newProject.title')}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          选择项目形态，DevOS 将在后台为您自动完成隔离容器构建与 Agent 标准注入。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Type Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t('modals.newProject.typeLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => setProjectType('web')}
                className={`p-3 rounded-xl border cursor-pointer transition text-center ${
                  projectType === 'web'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#10131b] border-[#202738] text-slate-400 hover:border-[#2f384e]'
                }`}
              >
                <Globe size={18} className="mx-auto mb-1.5" />
                <div className="text-xs font-semibold">Web 站点</div>
                <div className="text-[10px] text-slate-500 mt-0.5">DDEV 引擎</div>
              </div>

              <div
                onClick={() => setProjectType('script')}
                className={`p-3 rounded-xl border cursor-pointer transition text-center ${
                  projectType === 'script'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#10131b] border-[#202738] text-slate-400 hover:border-[#2f384e]'
                }`}
              >
                <Terminal size={18} className="mx-auto mb-1.5" />
                <div className="text-xs font-semibold">后端脚本/API</div>
                <div className="text-[10px] text-slate-500 mt-0.5">DevContainer</div>
              </div>

              <div
                onClick={() => setProjectType('hybrid')}
                className={`p-3 rounded-xl border cursor-pointer transition text-center ${
                  projectType === 'hybrid'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#10131b] border-[#202738] text-slate-400 hover:border-[#2f384e]'
                }`}
              >
                <Layers size={18} className="mx-auto mb-1.5" />
                <div className="text-xs font-semibold">Web + 脚本混编</div>
                <div className="text-[10px] text-slate-500 mt-0.5">双引擎协同</div>
              </div>
            </div>
          </div>

          {/* Project Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {t('modals.newProject.nameLabel')}
            </label>
            <input
              type="text"
              required
              placeholder={t('modals.newProject.namePlaceholder')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }
              }}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Project Slug */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {t('modals.newProject.slugLabel')}
            </label>
            <input
              type="text"
              placeholder={t('modals.newProject.slugPlaceholder')}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Project Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {t('modals.newProject.descLabel')}
            </label>
            <textarea
              rows={2}
              placeholder="简要描述项目目标..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1017] border border-[#283042] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition mt-2 shadow-lg shadow-emerald-950/20"
          >
            <span>{t('modals.newProject.createBtn')}</span>
            <ArrowRight size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};
