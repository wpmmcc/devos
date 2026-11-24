import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ListChecks,
  X,
  User,
  Bot,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BoardCard, BoardColumn } from '../types';

interface BoardViewProps {
  cards: BoardCard[];
  onMoveCard: (cardId: string, col: BoardColumn) => void;
  onOpenTest: (cardId: string) => void;
  onAddCard?: (title: string) => Promise<void>;
}

export const BoardView: React.FC<BoardViewProps> = ({
  cards,
  onMoveCard,
  onOpenTest,
  onAddCard,
}) => {
  const { t } = useTranslation();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  const handleCreateCardSubmit = async () => {
    if (!newCardTitle.trim() || !onAddCard || isSubmittingCard) return;
    setIsSubmittingCard(true);
    try {
      await onAddCard(newCardTitle.trim());
      setNewCardTitle('');
      setIsAddingCard(false);
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const columns: { id: BoardColumn; title: string; countColor: string }[] = [
    { id: 'todo', title: t('board.todo'), countColor: 'text-slate-400 bg-slate-800' },
    { id: 'doing', title: t('board.doing'), countColor: 'text-blue-400 bg-blue-900/40' },
    { id: 'testing', title: t('board.testing'), countColor: 'text-amber-400 bg-amber-900/40' },
    { id: 'done', title: t('board.done'), countColor: 'text-emerald-400 bg-emerald-900/40' },
  ];

  const selectedCard = cards.find((c) => c.card_id === selectedCardId);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0b0d13] relative select-none">
      {/* 4-Column Board Canvas */}
      <div className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-[920px]">
          {columns.map((col) => {
            const colCards = cards.filter((c) => c.column === col.id);

            return (
              <div
                key={col.id}
                className="flex-1 bg-[#12151d] rounded-xl border border-[#1e2330] flex flex-col min-w-[220px]"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-[#1e2330] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{col.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${col.countColor}`}>
                      {colCards.length}
                    </span>
                  </div>
                  {col.id === 'todo' && onAddCard && (
                    <button
                      onClick={() => setIsAddingCard((prev) => !prev)}
                      className="p-1 hover:text-emerald-400 hover:bg-[#1a1f2c] rounded transition text-slate-400"
                      title={t('board.addCard')}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                {/* Cards Container */}
                <div className="p-3 flex-1 overflow-y-auto space-y-2.5">
                  {col.id === 'todo' && isAddingCard && (
                    <div className="p-3 rounded-lg border border-emerald-500/40 bg-[#171d2b] space-y-2.5 shadow-lg">
                      <input
                        type="text"
                        autoFocus
                        placeholder={t('board.cardTitlePlaceholder')}
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            await handleCreateCardSubmit();
                          } else if (e.key === 'Escape') {
                            setIsAddingCard(false);
                            setNewCardTitle('');
                          }
                        }}
                        className="w-full bg-[#0d1017] border border-[#202738] rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCard(false);
                            setNewCardTitle('');
                          }}
                          className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 rounded hover:bg-[#202636] transition"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCardSubmit}
                          disabled={!newCardTitle.trim() || isSubmittingCard}
                          className="px-3 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded transition"
                        >
                          {isSubmittingCard ? t('common.loading') : t('common.confirm')}
                        </button>
                      </div>
                    </div>
                  )}

                  {colCards.map((card) => {
                    const checklistDone = card.checklist.filter((s) => s.checked).length;
                    const checklistTotal = card.checklist.length;
                    const isCardSelected = selectedCardId === card.card_id;

                    return (
                      <div
                        key={card.card_id}
                        onClick={() => setSelectedCardId(card.card_id)}
                        className={`p-3.5 rounded-lg border transition cursor-pointer select-none ${
                          isCardSelected
                            ? 'bg-[#1a2130] border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                            : col.id === 'testing'
                            ? 'bg-[#181e2b] border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/20'
                            : 'bg-[#151924] border-[#222838] hover:border-[#353e56]'
                        }`}
                      >
                        {/* Card ID & Status Tag */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-slate-400 font-medium">
                            {card.card_id}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            {card.updated_by === 'agent' ? (
                              <Bot size={11} className="text-cyan-400" />
                            ) : (
                              <User size={11} className="text-slate-400" />
                            )}
                            <span>{card.updated_by === 'agent' ? t('board.movedByAi') : t('board.movedByUser')}</span>
                          </span>
                        </div>

                        {/* Card Title */}
                        <h4 className="text-xs font-medium text-slate-100 leading-snug mb-2">
                          {card.title}
                        </h4>

                        {/* Acceptance Checklist Badge (if in testing) */}
                        {col.id === 'testing' && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTest(card.card_id);
                            }}
                            className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between hover:bg-amber-500/20 transition gap-2"
                          >
                            <span className="flex items-center gap-1.5 font-medium truncate min-w-0">
                              <ListChecks size={13} className="shrink-0" />
                              <span className="truncate">{t('board.checklistProgress', { done: checklistDone, total: checklistTotal })}</span>
                            </span>
                            <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                              {t('board.goToTest')} <ArrowRight size={11} />
                            </span>
                          </div>
                        )}

                        {/* Card Action Controls */}
                        <div className="mt-3 pt-2.5 border-t border-[#1e2330] flex items-center justify-between text-[11px] text-slate-400">
                          {col.id === 'todo' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveCard(card.card_id, 'doing');
                              }}
                              className="hover:text-blue-400 flex items-center gap-1 transition"
                            >
                              <span>{t('board.startDev')}</span>
                              <ArrowRight size={11} />
                            </button>
                          )}

                          {col.id === 'doing' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTest(card.card_id);
                              }}
                              className="hover:text-amber-400 flex items-center gap-1 transition text-amber-400 font-medium"
                            >
                              <span>{t('board.submitTest')}</span>
                              <ArrowRight size={11} />
                            </button>
                          )}

                          {col.id === 'testing' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveCard(card.card_id, 'done');
                              }}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition font-medium"
                            >
                              <CheckCircle2 size={12} />
                              <span>{t('board.confirmDone')}</span>
                            </button>
                          )}

                          {col.id === 'done' && (
                            <span className="text-emerald-400/80 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>{t('board.accepted')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colCards.length === 0 && (
                    <div className="h-28 border border-dashed border-[#1e2330] rounded-lg flex items-center justify-center text-slate-600 text-xs">
                      {t('board.emptyCards')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-Out Detail Drawer */}
      {selectedCard && (
        <div className="w-full max-w-[380px] sm:w-[380px] md:w-[400px] bg-[#12151d] border-l border-[#1e2330] flex flex-col shrink-0 shadow-2xl z-20 overflow-hidden animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-[#1e2330] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-amber-400 font-bold">
                {selectedCard.card_id}
              </span>
              <span className="text-xs font-semibold text-slate-200">{t('board.cardDetails')}</span>
            </div>
            <button
              onClick={() => setSelectedCardId(null)}
              className="p-1 hover:bg-[#1e2330] text-slate-400 hover:text-slate-100 rounded transition"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-100 leading-snug">
                {selectedCard.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2433] text-slate-300 border border-[#2a3245]">
                  {t('board.currentCol')}: {columns.find((c) => c.id === selectedCard.column)?.title}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t('board.lastUpdated')}: {new Date(selectedCard.updated_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Quick Column Switch */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">{t('board.moveStatus')}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => onMoveCard(selectedCard.card_id, col.id)}
                    className={`py-1.5 rounded text-[11px] font-medium transition border ${
                      selectedCard.column === col.id
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-[#181d2a] text-slate-400 border-[#232938] hover:text-slate-200'
                    }`}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">{t('board.summary')}</label>
              <div className="p-3 bg-[#0d1017] rounded-lg border border-[#202738] text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedCard.summary_plain || selectedCard.description || t('board.noDescription')}
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <ListChecks size={13} className="text-amber-400" />
                  <span>{t('board.acceptanceSteps', { count: selectedCard.checklist.length })}</span>
                </label>
              </div>

              <div className="space-y-2">
                {selectedCard.checklist.map((step) => (
                  <div
                    key={step.step}
                    className="p-2.5 rounded-lg bg-[#0d1017] border border-[#202738] text-xs space-y-1"
                  >
                    <div className="font-medium text-slate-200 flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">{step.step}.</span>
                      <span>{step.action}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 pl-4">
                      {t('board.expectedResult', { expected: step.expected })}
                    </div>
                  </div>
                ))}

                {selectedCard.checklist.length === 0 && (
                  <div className="text-xs text-slate-600 p-3 text-center">
                    {t('board.noChecklist')}
                  </div>
                )}
              </div>
            </div>

            {/* Jump to Test */}
            <button
              onClick={() => onOpenTest(selectedCard.card_id)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/20"
            >
              <span>{t('board.openTestWorkbench')}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
