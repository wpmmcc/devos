import React from 'react';
import { CheckCircle2, Clock, PlayCircle, ArrowRight, ListChecks, Plus } from 'lucide-react';
import { BoardCard, BoardColumn } from '../types';

interface BoardViewProps {
  cards: BoardCard[];
  onMoveCard: (cardId: string, col: BoardColumn) => void;
  onOpenTest: (cardId: string) => void;
}

const COLUMNS: { id: BoardColumn; title: string; countColor: string }[] = [
  { id: 'todo', title: '待开发', countColor: 'text-slate-400 bg-slate-800' },
  { id: 'doing', title: '开发中', countColor: 'text-blue-400 bg-blue-900/40' },
  { id: 'testing', title: '待我测试', countColor: 'text-amber-400 bg-amber-900/40' },
  { id: 'done', title: '已完成', countColor: 'text-emerald-400 bg-emerald-900/40' },
];

export const BoardView: React.FC<BoardViewProps> = ({ cards, onMoveCard, onOpenTest }) => {
  return (
    <div className="flex-1 p-6 overflow-x-auto bg-[#0b0d13]">
      <div className="flex gap-4 h-full min-w-[920px]">
        {COLUMNS.map((col) => {
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
              </div>

              {/* Cards Container */}
              <div className="p-3 flex-1 overflow-y-auto space-y-2.5">
                {colCards.map((card) => {
                  const checklistDone = card.checklist.filter((s) => s.checked).length;
                  const checklistTotal = card.checklist.length;

                  return (
                    <div
                      key={card.card_id}
                      className={`p-3.5 rounded-lg border transition cursor-pointer select-none ${
                        col.id === 'testing'
                          ? 'bg-[#181e2b] border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/20'
                          : 'bg-[#151924] border-[#222838] hover:border-[#353e56]'
                      }`}
                    >
                      {/* Card ID & Status Tag */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-slate-400 font-medium">
                          {card.card_id}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          由 {card.updated_by === 'agent' ? 'AI 助手' : '用户'} 推进
                        </span>
                      </div>

                      {/* Card Title */}
                      <h4 className="text-xs font-medium text-slate-100 leading-snug mb-2">
                        {card.title}
                      </h4>

                      {/* Acceptance Checklist Badge (if in testing) */}
                      {col.id === 'testing' && (
                        <div
                          onClick={() => onOpenTest(card.card_id)}
                          className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between hover:bg-amber-500/20 transition"
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <ListChecks size={13} />
                            <span>白话验收清单 ({checklistDone}/{checklistTotal})</span>
                          </span>
                          <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-0.5">
                            去测试 <ArrowRight size={11} />
                          </span>
                        </div>
                      )}

                      {/* Card Action Controls */}
                      <div className="mt-3 pt-2.5 border-t border-[#1e2330] flex items-center justify-between text-[11px] text-slate-400">
                        {col.id === 'todo' && (
                          <button
                            onClick={() => onMoveCard(card.card_id, 'doing')}
                            className="hover:text-blue-400 flex items-center gap-1 transition"
                          >
                            <span>开始开发</span>
                            <ArrowRight size={11} />
                          </button>
                        )}

                        {col.id === 'doing' && (
                          <button
                            onClick={() => onOpenTest(card.card_id)}
                            className="hover:text-amber-400 flex items-center gap-1 transition text-amber-400 font-medium"
                          >
                            <span>提交提测单</span>
                            <ArrowRight size={11} />
                          </button>
                        )}

                        {col.id === 'testing' && (
                          <button
                            onClick={() => onMoveCard(card.card_id, 'done')}
                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition font-medium"
                          >
                            <CheckCircle2 size={12} />
                            <span>确认全部通过并完成</span>
                          </button>
                        )}

                        {col.id === 'done' && (
                          <span className="text-emerald-400/80 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            <span>已验收通过</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colCards.length === 0 && (
                  <div className="h-28 border border-dashed border-[#1e2330] rounded-lg flex items-center justify-center text-slate-600 text-xs">
                    暂无卡片
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
