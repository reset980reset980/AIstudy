import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { ProblemAnalysis, SimilarProblem } from '../types';
import StepVisual from './StepVisual';
import SafeSvg from './SafeSvg';
import { PROVIDERS } from '../shared/ai/models';
import { CheckCircle, BookOpen, Lightbulb, ArrowRight, RefreshCw, Triangle, X, MonitorPlay, Maximize2 } from 'lucide-react';

interface AnalysisViewProps {
  analysis: ProblemAnalysis;
  originalImageUrl: string | null;
  onReset: () => void;
  /** 같은 개념의 새 유사 문제 3개 더 만들기 */
  onMore?: () => Promise<void>;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, originalImageUrl, onReset, onMore }) => {
  const [selectedSimilarProblem, setSelectedSimilarProblem] = useState<SimilarProblem | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const handleMore = async () => {
    if (!onMore) return;
    setLoadingMore(true);
    try { await onMore(); } finally { setLoadingMore(false); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto sm:p-4 space-y-8 animate-fade-in pb-20">
      
      {/* Header / Summary Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-green-400"></div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">🧭</span> 문제 해결 지도
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                <h3 className="text-blue-700 dark:text-blue-400 font-semibold text-sm mb-2 flex items-center gap-2">
                   <CheckCircle size={16} /> 문제의 목표
                </h3>
                <p className="text-slate-700 dark:text-slate-300 text-sm">{analysis.goal}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900">
                <h3 className="text-orange-700 dark:text-orange-400 font-semibold text-sm mb-2 flex items-center gap-2">
                   <BookOpen size={16} /> 필요한 지식
                </h3>
                <ul className="text-slate-700 dark:text-slate-300 text-sm list-disc list-inside">
                  {(analysis.requiredKnowledge || []).map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900">
                <h3 className="text-purple-700 dark:text-purple-400 font-semibold text-sm mb-2 flex items-center gap-2">
                   <Lightbulb size={16} /> 난이도 & 태그
                </h3>
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-white dark:bg-slate-700 rounded-md text-xs font-medium text-slate-600 dark:text-slate-200 border border-purple-100 dark:border-purple-800">
                        난이도 {analysis.difficulty}
                    </span>
                    {(analysis.tags || []).map(t => (
                        <span key={t} className="px-2 py-1 bg-white dark:bg-slate-700 rounded-md text-xs font-medium text-slate-600 dark:text-slate-200 border border-purple-100 dark:border-purple-800">
                            #{t}
                        </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Steps Horizontal Scroll */}
      <div className="relative">
         <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span> AI 선생님의 풀이 노트
         </h3>
         
         <div className="flex gap-6 overflow-x-auto pb-8 horizontal-scroll snap-x">
            
            {/* Original Problem Card */}
            <div className="w-[85vw] max-w-[320px] shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 snap-center flex flex-col">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">원본 문제</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-4">
                    {originalImageUrl && (
                        <div className="rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
                            <img src={originalImageUrl} alt="Original Problem" className="w-full h-auto object-contain" />
                        </div>
                    )}
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        {analysis.ocrText}
                    </p>
                </div>
            </div>

            {/* Dynamic Steps */}
            {analysis.steps.map((step, index) => (
                <div key={index} className="w-[85vw] max-w-[350px] shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 p-5 snap-center flex flex-col relative">
                    <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10 hidden md:block">
                         {index < analysis.steps.length - 1 && <ArrowRight className="text-slate-300 dark:text-slate-600" />}
                    </div>

                    <div className="mb-4">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                            {step.stepNumber}단계
                        </span>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white mt-2">{step.title}</h4>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-4 border border-slate-100 dark:border-slate-700">
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">{step.description}</p>
                        <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 text-center font-mono text-blue-600 dark:text-blue-400 font-bold text-lg shadow-sm">
                            {step.equation}
                        </div>
                    </div>

                    {/* Only render visual if visualData exists */}
                    {step.visualData && <StepVisual visualData={step.visualData} />}

                    <div className="mt-auto pt-4 space-y-2">
                        {/* Easy Understanding Tip */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-3 border border-yellow-100 dark:border-yellow-900/30">
                            <h5 className="text-yellow-700 dark:text-yellow-500 text-xs font-bold flex items-center gap-1 mb-1">
                                <span className="text-sm">💡</span> 쉽게 이해하기
                            </h5>
                            <p className="text-slate-700 dark:text-slate-300 text-sm handwritten text-base">
                                {step.tip}
                            </p>
                        </div>
                        
                        {/* Math Principle */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900/30">
                            <h5 className="text-indigo-700 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 mb-1">
                                <span className="text-sm"><Triangle size={12} className="fill-indigo-700 dark:fill-indigo-400" /></span> 핵심 개념
                            </h5>
                            <p className="text-slate-700 dark:text-slate-300 text-sm">
                                {step.mathPrinciple}
                            </p>
                        </div>
                    </div>
                </div>
            ))}

            {/* Final Answer Card */}
            <div className="w-[85vw] max-w-[320px] shrink-0 bg-gradient-to-b from-red-50 to-white dark:from-red-900/10 dark:to-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-5 snap-center flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-500 dark:text-red-400">
                    <CheckCircle size={32} />
                 </div>
                 <h3 className="text-slate-400 dark:text-slate-500 font-medium text-sm uppercase tracking-wider mb-2">정답</h3>
                 <div className="text-4xl font-extrabold text-red-500 dark:text-red-400 handwritten">
                    {analysis.finalAnswer}
                 </div>
                 {analysis.aiProvider && (
                   <div className="mt-8 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600">
                      {PROVIDERS[analysis.aiProvider]?.name} · {analysis.aiModel}
                   </div>
                 )}
                 <p className="mt-3 text-[11px] text-slate-400">AI 풀이는 틀릴 수 있어요. 꼭 직접 확인해 보세요.</p>
            </div>
         </div>
      </div>

      {/* Similar Problems Section */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <span className="text-2xl">🎯</span> 유사 문제 풀어보기
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(analysis.similarProblems || []).map((prob, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded">문제 {idx + 1}</span>
                    </div>
                    
                    {/* Visual Area - Renders ONLY if svgCode exists */}
                    {prob.svgCode ? (
                        <div 
                            className="w-full aspect-square bg-white rounded-lg border border-slate-200 dark:border-slate-600 mb-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors relative group"
                            onClick={() => setSelectedSimilarProblem(prob)}
                        >
                             <div className="absolute inset-0 flex items-center justify-center p-2">
                                <SafeSvg svg={prob.svgCode} />
                             </div>
                             <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                                <Maximize2 className="text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-full" size={28} />
                             </div>
                        </div>
                    ) : (
                        // Spacer if no image, or nothing
                        <div className="mb-2"></div>
                    )}

                    {/* Question Text */}
                    <p className="text-slate-700 dark:text-slate-300 font-medium mb-4 text-sm flex-grow whitespace-pre-wrap">
                        {prob.question}
                    </p>

                    <div className="mt-auto space-y-3">
                        <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                            <p className="text-green-700 dark:text-green-400 text-xs">
                                <span className="font-bold mr-1">힌트:</span> {prob.hint}
                            </p>
                        </div>
                        <button 
                            onClick={() => setSelectedSimilarProblem(prob)}
                            className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
                        >
                            <MonitorPlay size={16} /> 풀이 및 정답 확인
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {onMore && (
        <div className="flex flex-col items-center gap-2 -mt-2">
          <button
            onClick={handleMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 disabled:opacity-60 shadow-lg shadow-blue-200 dark:shadow-none transition-colors"
          >
            {loadingMore ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {loadingMore ? 'AI가 새 문제를 만드는 중...' : '다른 문제 더 풀어보기'}
          </button>
          <p className="text-xs text-slate-400">같은 개념으로 새 문제 3개를 더 만들어요. 시험 탭에도 함께 출제돼요.</p>
        </div>
      )}

      <div className="flex justify-center mt-12">
        <button 
            onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-full font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-lg"
        >
            <RefreshCw size={18} />
            다른 문제 분석하기
        </button>
      </div>

      {/* Solution Modal */}
      {selectedSimilarProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSimilarProblem(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="text-blue-500">📝</span> 유사 문제 풀이 과정
                    </h3>
                    <button 
                        onClick={() => setSelectedSimilarProblem(null)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#fdfbf7] dark:bg-slate-900">
                    <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">문제</span>
                        <div className="flex flex-col md:flex-row gap-6">
                            {selectedSimilarProblem.svgCode && (
                                /* Modal Image - Renders only if exists */
                                <div className="w-full md:w-1/2 max-w-[320px] aspect-square bg-white rounded-lg flex items-center justify-center p-4 border border-slate-200 dark:border-slate-600 mx-auto md:mx-0">
                                     <SafeSvg svg={selectedSimilarProblem.svgCode} />
                                </div>
                            )}
                            <div className="flex-1 flex flex-col justify-center">
                                <p className="text-slate-800 dark:text-slate-100 font-medium text-lg mb-6 leading-relaxed">{selectedSimilarProblem.question}</p>
                                <div className="inline-flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold border border-red-100 dark:border-red-900/30 self-start">
                                    <span>정답:</span>
                                    <span className="text-2xl">{selectedSimilarProblem.answer}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <ArrowRight size={18} className="text-blue-500" /> 단계별 해설
                    </h4>

                    <div className="space-y-6">
                        {selectedSimilarProblem.steps && selectedSimilarProblem.steps.length > 0 ? (
                            selectedSimilarProblem.steps.map((step, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-blue-100 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                            {step.stepNumber}단계
                                        </span>
                                        <h5 className="font-bold text-slate-800 dark:text-slate-100">{step.title}</h5>
                                    </div>
                                    
                                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-3 pl-1">{step.description}</p>
                                    
                                    {step.equation && (
                                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 font-mono text-blue-600 dark:text-blue-400 font-bold mb-3">
                                            {step.equation}
                                        </div>
                                    )}

                                    {/* Visual Data for Step - Only if exists */}
                                    {step.visualData && <StepVisual visualData={step.visualData} />}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                        <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-3 border border-yellow-100 dark:border-yellow-900/30">
                                            <p className="text-yellow-800 dark:text-yellow-500 text-xs font-bold mb-1">💡 팁</p>
                                            <p className="text-slate-700 dark:text-slate-300 text-sm">{step.tip}</p>
                                        </div>
                                        <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900/30">
                                            <p className="text-indigo-800 dark:text-indigo-400 text-xs font-bold mb-1">📐 핵심 개념</p>
                                            <p className="text-slate-700 dark:text-slate-300 text-sm">{step.mathPrinciple}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                상세 풀이가 제공되지 않는 문제입니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end">
                    <button 
                        onClick={() => setSelectedSimilarProblem(null)}
                        className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisView;