export enum DiagramType {
  BAR = 'BAR',
  PIE = 'PIE',
  NUMBER_LINE = 'NUMBER_LINE',
  GEOMETRY = 'GEOMETRY', // New type for geometry
  NONE = 'NONE'
}

export interface SolutionStep {
  stepNumber: number;
  title: string;
  description: string;
  equation: string;
  tip: string; 
  mathPrinciple: string; // The underlying mathematical principle
  visualData?: {
    type: DiagramType;
    data?: any[]; // For charts
    svgCode?: string; // New field for raw SVG string
    dataKey?: string;
    labelKey?: string;
  };
}

export interface SimilarProblem {
  question: string;
  answer: string;
  hint: string;
  svgCode?: string; // Visual for similar problem
  steps: SolutionStep[]; // Full step-by-step solution for the similar problem
}

export interface ProblemAnalysis {
  ocrText: string;
  tags: string[]; 
  difficulty: string; 
  goal: string; 
  requiredKnowledge: string[];
  steps: SolutionStep[];
  finalAnswer: string;
  similarProblems: SimilarProblem[];
}

export interface AnalysisState {
  isLoading: boolean;
  data: ProblemAnalysis | null;
  error: string | null;
}

// Firebase History Item
export interface ProblemHistoryItem extends ProblemAnalysis {
  id: string;
  userId: string;
  timestamp: number; // Unix timestamp
  dateString: string; // Readable date
}

// Quiz Types
export interface QuizQuestion {
  id: string;
  question: string;
  answer: string;
  isCorrect?: boolean;
  userAnswer?: string;
  originalProblemId: string;
}
