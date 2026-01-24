/**
 * Remotion Composition Types
 * Type definitions for educational video compositions
 */

// --- Composition Types ---

export type CompositionType =
  | 'explainer'
  | 'math-visualization'
  | 'timeline'
  | 'lesson-summary'
  | 'quiz-intro'
  // New composition types
  | 'assignment-steps'
  | 'objectives-intro'
  | 'vocabulary'
  | 'process-steps'
  | 'comparison';

// --- Base Props ---

export interface BaseCompositionProps {
  title: string;
  direction: 'rtl' | 'ltr';
  theme: 'light' | 'dark';
  brandColors: BrandColors;
}

export interface BrandColors {
  primary: string;    // wizdi.royal (#2B59C3)
  secondary: string;  // wizdi.action (violet #8B5CF6)
  accent: string;     // wizdi.cyan (#00C2FF)
  gold: string;       // wizdi.gold (#FFD500)
  background: string; // wizdi.cloud (#F5F9FF)
}

// Default Wizdi brand colors
export const WIZDI_COLORS: BrandColors = {
  primary: '#2B59C3',
  secondary: '#8B5CF6',
  accent: '#00C2FF',
  gold: '#FFD500',
  background: '#F5F9FF'
};

// --- Explainer Video Props ---

export interface ExplainerVideoProps extends BaseCompositionProps {
  concept: string;
  explanation: string;
  examples: string[];
  duration?: number;
  voiceoverUrl?: string;
}

// --- Math Visualization Props ---

export type MathOperation =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'fractions'
  | 'equations'
  | 'geometry';

export interface MathStep {
  formula: string;        // LaTeX format
  explanation: string;    // Hebrew explanation
  animation: 'fade' | 'slide' | 'scale' | 'draw';
  highlight?: string[];   // Parts to highlight
}

export interface MathVisualizationProps extends BaseCompositionProps {
  operation: MathOperation;
  problem: string;
  steps: MathStep[];
  finalAnswer: string;
}

// --- Timeline Animation Props ---

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface TimelineAnimationProps extends BaseCompositionProps {
  events: TimelineEvent[];
  layout: 'horizontal' | 'vertical';
  showConnectors: boolean;
}

// --- Lesson Summary Props ---

export interface LessonSummaryProps extends BaseCompositionProps {
  lessonTitle: string;
  keyPoints: string[];
  nextSteps?: string[];
  achievements?: {
    xp: number;
    badges?: string[];
  };
}

// --- Quiz Intro Props ---

export interface QuizIntroProps extends BaseCompositionProps {
  quizTitle: string;
  questionCount: number;
  timeLimit?: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

// --- Assignment Steps Props ---

export interface AssignmentStep {
  number: number;
  title: string;
  description: string;
  icon?: string;
}

export interface AssignmentStepsProps extends BaseCompositionProps {
  taskTitle: string;
  steps: AssignmentStep[];
  dueDate?: string;
  tips?: string[];
}

// --- Objectives Intro Props ---

export interface ObjectivesIntroProps extends BaseCompositionProps {
  lessonTitle: string;
  objectives: string[];
  duration?: string;       // e.g., "45 דקות"
  welcomeMessage?: string;
}

// --- Vocabulary Props ---

export interface VocabularyWord {
  term: string;
  definition: string;
  example?: string;
  icon?: string;
}

export interface VocabularyProps extends BaseCompositionProps {
  topic: string;
  words: VocabularyWord[];
  showExamples?: boolean;
}

// --- Process Steps Props ---

export interface ProcessStep {
  number: number;
  title: string;
  detail: string;
  icon?: string;
}

export interface ProcessStepsProps extends BaseCompositionProps {
  processTitle: string;
  description?: string;
  steps: ProcessStep[];
}

// --- Comparison Props ---

export interface ComparisonItem {
  name: string;
  description: string;
  icon?: string;
  attributes: Record<string, string>;
}

export interface ComparisonProps extends BaseCompositionProps {
  comparisonTitle: string;
  itemA: ComparisonItem;
  itemB: ComparisonItem;
  criteria: string[];
}

// --- Video Block for Integration ---

export type RenderStatus = 'pending' | 'rendering' | 'ready' | 'error';

export interface RemotionVideoBlockContent {
  compositionId: string;
  compositionType: CompositionType;
  props: Record<string, unknown>;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  status: RenderStatus;
  renderProgress?: number;
  jobId?: string;
  error?: string;
}

// --- Helper Functions ---

export const getDefaultProps = (type: CompositionType): Partial<BaseCompositionProps> => ({
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
});

export const getDurationInFrames = (type: CompositionType, fps = 30): number => {
  const durations: Record<CompositionType, number> = {
    'explainer': 10,
    'math-visualization': 15,
    'timeline': 20,
    'lesson-summary': 10,
    'quiz-intro': 5,
    // New composition types
    'assignment-steps': 12,
    'objectives-intro': 8,
    'vocabulary': 15,
    'process-steps': 12,
    'comparison': 15
  };
  return durations[type] * fps;
};
