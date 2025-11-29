import React, { useState, useEffect } from 'react';
import { ProblemHistoryItem, QuizQuestion } from '../types';
import { GraduationCap, CheckCircle, XCircle, ArrowRight, RefreshCw, Trophy } from 'lucide-react';

interface QuizViewProps {
  history: ProblemHistoryItem[];
  onExit: () => void;
}

const QuizView: React.FC<QuizViewProps> = ({ history, onExit }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [userInput, setUserInput] = useState('');

  // Initialize Quiz
  useEffect(() => {
    if (history.length === 0) return;

    // Shuffle and pick up to 5 questions
    const shuffled = [...history].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5).map(item => ({
      id: `q-${Math.random().toString(36).substr(2, 9)}`,
      originalProblemId: item.id,
      question: item.ocrText, // Use extracted text as the question
      answer: item.finalAnswer,
      userAnswer: ''
    }));
    setQuestions(selected);
  }, [history]);

  const handleCheckAnswer = () => {
    // Simple self-grading logic for now (showing the answer)
    setShowResult(true);
  };

  const handleMark = (correct: boolean) => {
    const updated = [...questions];
    updated[currentIndex].isCorrect = correct;
    updated[currentIndex].userAnswer = userInput;
    setQuestions(updated);
    
    if (correct) setScore(s => s + 1);

    // Next question or Finish
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(c => c + 1);
        setShowResult(false);
        setUserInput('');
      } else {
        setIsFinished(true);
      }
    }, 500);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-8">
        <GraduationCap size={48} className="text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">문제가 부족해요</h3>
        <p className="text-slate-500 mt-2">
          먼저 문제를 업로드하여 학습 기록을 쌓아주세요.<br/>
          최소 1개의 학습 기록이 필요합니다.
        </p>
        <button onClick={onExit} className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg">돌아가기</button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center animate-fade-in max-w-lg mx-auto mt-10 shadow-lg">
        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy size={48} className="text-yellow-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">시험 종료!</h2>
        <p className="text-slate-500 mb-8">수고하셨습니다.</p>
        
        <div className="text-5xl font-black text-blue-600 mb-2">{score * (100 / questions.length)}점</div>
        <p className="text-sm text-slate-400 mb-8">{questions.length}문제 중 {score}문제 정답</p>

        <div className="space-y-3 mb-8">
          {questions.map((q, idx) => (
            <div key={q.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
              <span className="text-slate-600 font-medium truncate w-1/2 text-left">
                {idx + 1}. {q.question}
              </span>
              {q.isCorrect ? (
                <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> 정답</span>
              ) : (
                <span className="text-red-500 font-bold flex items-center gap-1"><XCircle size={14}/> 오답</span>
              )}
            </div>
          ))}
        </div>

        <button 
          onClick={onExit}
          className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
        >
          확인
        </button>
      </div>
    );
  }

  if (questions.length === 0) return <div>로딩 중...</div>;

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 animate-fade-in">
      {/* Progress */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-slate-500">
          문제 {currentIndex + 1} / {questions.length}
        </span>
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-600">
          나가기
        </button>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full mb-8">
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-300" 
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-8 min-h-[300px] flex flex-col">
        <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full mb-4 self-start">
          문제
        </span>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-relaxed mb-8 flex-grow whitespace-pre-wrap">
          {currentQ.question}
        </h3>

        {!showResult ? (
          <div className="space-y-4">
             <input 
                type="text" 
                placeholder="정답을 입력하거나 생각해 보세요"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
             />
             <button 
                onClick={handleCheckAnswer}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
             >
                정답 확인하기
             </button>
          </div>
        ) : (
          <div className="animate-fade-in bg-slate-50 rounded-xl p-6 border border-slate-100">
            <p className="text-sm text-slate-500 mb-2 font-bold">정답</p>
            <p className="text-2xl font-bold text-blue-600 mb-6">{currentQ.answer}</p>
            
            <p className="text-center text-slate-700 font-medium mb-4">맞추셨나요?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => handleMark(false)}
                className="flex-1 py-3 border-2 border-red-100 bg-white text-red-500 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle /> 틀렸어요
              </button>
              <button 
                onClick={() => handleMark(true)}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
              >
                <CheckCircle /> 맞았어요!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
