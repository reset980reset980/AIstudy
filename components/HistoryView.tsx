import React from 'react';
import { ProblemHistoryItem } from '../types';
import { BookOpen, Calendar, ChevronRight, Tag } from 'lucide-react';

interface HistoryViewProps {
  history: ProblemHistoryItem[];
  onSelectProblem: (item: ProblemHistoryItem) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onSelectProblem }) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={40} className="text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">아직 학습 기록이 없어요</h3>
        <p className="text-slate-500 dark:text-slate-400">
          문제를 사진으로 찍거나 업로드해서<br />
          나만의 오답 노트를 만들어보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
        <BookOpen className="text-blue-500" />
        나의 학습 기록 (문제 은행)
      </h2>

      <div className="grid gap-4">
        {history.map((item) => (
          <div 
            key={item.id}
            onClick={() => onSelectProblem(item)}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium">
                <Calendar size={14} />
                {item.dateString}
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                item.difficulty === 'High' || item.difficulty === '상' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                item.difficulty === 'Medium' || item.difficulty === '중' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {item.difficulty}
              </span>
            </div>

            <p className="text-slate-800 dark:text-slate-100 font-medium mb-4 line-clamp-2">
              {item.ocrText}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {item.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded border border-slate-100 dark:border-slate-600">
                    <Tag size={12} /> {tag}
                  </span>
                ))}
              </div>
              <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;