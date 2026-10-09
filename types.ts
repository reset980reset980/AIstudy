import type { ProviderId } from './shared/ai/models';

export enum DiagramType {
  BAR = 'BAR',
  PIE = 'PIE',
  NUMBER_LINE = 'NUMBER_LINE',
  GEOMETRY = 'GEOMETRY',
  NONE = 'NONE',
}

export interface VisualData {
  type: DiagramType | string;
  data?: { name: string; value: number }[];
  svgCode?: string;
}

export interface SolutionStep {
  stepNumber: number;
  title: string;
  description: string;
  equation: string;
  tip: string;
  mathPrinciple: string;
  visualData?: VisualData | null;
}

export interface SimilarProblem {
  question: string;
  answer: string;
  hint: string;
  svgCode?: string;
  steps: SolutionStep[];
  /** 틀린 문제(이 배열의 인덱스)에서 자동으로 만든 오답 연습 문제 */
  fromWrong?: number;
}

export const SUBJECTS = ['수학', '과학', '사회', '국어', '영어', '기타'] as const;

export interface ProblemAnalysis {
  ocrText: string;
  /** 과목 (예전 기록에는 없음 → 미분류) */
  subject?: string;
  /** 단원 (예: 4학년 1학기 2. 각도) */
  unit?: string;
  tags: string[];
  difficulty: string;
  goal: string;
  requiredKnowledge: string[];
  steps: SolutionStep[];
  finalAnswer: string;
  similarProblems: SimilarProblem[];
  /** 분석에 사용한 AI (새 기록부터 저장) */
  aiProvider?: ProviderId;
  aiModel?: string;
}

export interface AnalysisState {
  isLoading: boolean;
  data: ProblemAnalysis | null;
  error: string | null;
}

export interface ProblemHistoryItem extends ProblemAnalysis {
  id: string;
  userId: string;
  timestamp: number;
  dateString: string;
}

// 시험
export interface QuizQuestion {
  id: string;
  question: string;
  answer: string;
  hint: string;
  svgCode?: string;
  steps: SolutionStep[];
  sourceTitle: string;
  originalProblemId: string;
  index: number;
  tags: string[];
  subject: string;
  unit: string;
  userAnswer?: string;
  isCorrect?: boolean;
  feedback?: string;
}

export interface QuizResult {
  id?: string;
  timestamp: number;
  total: number;
  correct: number;
}

// 사용자 설정
export interface EncryptedKey {
  cipher: string;
  last4: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  gradeLevel: string;
  provider: ProviderId;
  models: Record<ProviderId, string>;
  /** 일반 사용자: 본인 Firestore 문서에 저장되는 키 */
  keys: Partial<Record<ProviderId, string>>;
  /** 관리자: 서버에서 암호화된 키 (평문 저장 안 함) */
  encKeys: Partial<Record<ProviderId, EncryptedKey>>;
}
