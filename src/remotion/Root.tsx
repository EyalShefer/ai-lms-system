/**
 * Remotion Root Component
 * Registers all video compositions for the AI-LMS system
 */

import React from 'react';
import { Composition, Still } from 'remotion';

// Compositions
import { ExplainerVideo } from './compositions/ExplainerVideo';
import { MathVisualization } from './compositions/MathVisualization';
import { TimelineAnimation } from './compositions/TimelineAnimation';
import { LessonSummary } from './compositions/LessonSummary';
// New compositions
import { AssignmentSteps } from './compositions/AssignmentSteps';
import { ObjectivesIntro } from './compositions/ObjectivesIntro';
import { VocabularyFlashcards } from './compositions/VocabularyFlashcards';
import { ProcessSteps } from './compositions/ProcessSteps';
import { Comparison } from './compositions/Comparison';

// Types
import {
  WIZDI_COLORS,
  getDurationInFrames,
  type ExplainerVideoProps,
  type MathVisualizationProps,
  type TimelineAnimationProps,
  type LessonSummaryProps,
  type AssignmentStepsProps,
  type ObjectivesIntroProps,
  type VocabularyProps,
  type ProcessStepsProps,
  type ComparisonProps
} from './types/composition.types';

// Default props for each composition
const defaultExplainerProps: ExplainerVideoProps = {
  title: 'מושג חדש',
  concept: 'כאן יופיע המושג המרכזי',
  explanation: 'כאן יופיע הסבר מפורט על המושג, כולל דוגמאות והקשרים.',
  examples: ['דוגמה ראשונה', 'דוגמה שנייה', 'דוגמה שלישית'],
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultMathProps: MathVisualizationProps = {
  title: 'תרגיל חשבון',
  operation: 'addition',
  problem: '25 + 17 = ?',
  steps: [
    { formula: '25 + 17', explanation: 'נתחיל עם התרגיל', animation: 'fade' },
    { formula: '20 + 10 = 30', explanation: 'נחבר את העשרות', animation: 'slide' },
    { formula: '5 + 7 = 12', explanation: 'נחבר את היחידות', animation: 'slide' },
    { formula: '30 + 12 = 42', explanation: 'נחבר את התוצאות', animation: 'scale' }
  ],
  finalAnswer: '42',
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultTimelineProps: TimelineAnimationProps = {
  title: 'ציר זמן היסטורי',
  events: [
    { date: '1948', title: 'הקמת המדינה', description: 'הכרזת העצמאות', icon: '🇮🇱' },
    { date: '1967', title: 'מלחמת ששת הימים', description: 'ניצחון מהיר', icon: '⚔️' },
    { date: '1973', title: 'מלחמת יום כיפור', description: 'התקפת פתע', icon: '🔥' },
    { date: '1979', title: 'הסכם השלום', description: 'שלום עם מצרים', icon: '🕊️' }
  ],
  layout: 'vertical',
  showConnectors: true,
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultSummaryProps: LessonSummaryProps = {
  title: 'סיכום',
  lessonTitle: 'שם השיעור',
  keyPoints: [
    'נקודה חשובה ראשונה',
    'נקודה חשובה שנייה',
    'נקודה חשובה שלישית'
  ],
  nextSteps: ['המשך לשיעור הבא', 'תרגול נוסף'],
  achievements: {
    xp: 150,
    badges: ['🌟', '📚', '🎯']
  },
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

// New composition default props
const defaultAssignmentProps: AssignmentStepsProps = {
  title: 'הוראות משימה',
  taskTitle: 'משימה לדוגמה',
  steps: [
    { number: 1, title: 'קראו את ההוראות', description: 'קראו את כל ההוראות בעיון לפני תחילת העבודה', icon: '📖' },
    { number: 2, title: 'אספו חומרים', description: 'אספו את כל החומרים הדרושים למשימה', icon: '📦' },
    { number: 3, title: 'בצעו את המשימה', description: 'בצעו את המשימה לפי השלבים', icon: '✏️' },
    { number: 4, title: 'בדקו את העבודה', description: 'בדקו שהשלמתם את כל החלקים', icon: '✅' }
  ],
  dueDate: 'יום ראשון הקרוב',
  tips: ['תכננו את הזמן מראש', 'אל תהססו לשאול שאלות'],
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultObjectivesProps: ObjectivesIntroProps = {
  title: 'מטרות השיעור',
  lessonTitle: 'שם השיעור',
  objectives: [
    'להבין את המושג המרכזי',
    'ליישם את הידע בתרגילים',
    'לנתח מצבים שונים'
  ],
  duration: '45 דקות',
  welcomeMessage: 'מה נלמד היום?',
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultVocabularyProps: VocabularyProps = {
  title: 'מילון מונחים',
  topic: 'נושא הלימוד',
  words: [
    { term: 'מונח ראשון', definition: 'הגדרה של המונח הראשון', example: 'דוגמה לשימוש במונח', icon: '📚' },
    { term: 'מונח שני', definition: 'הגדרה של המונח השני', example: 'דוגמה לשימוש במונח', icon: '🔬' },
    { term: 'מונח שלישי', definition: 'הגדרה של המונח השלישי', example: 'דוגמה לשימוש במונח', icon: '💡' }
  ],
  showExamples: true,
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultProcessProps: ProcessStepsProps = {
  title: 'תהליך',
  processTitle: 'שלבי התהליך',
  description: 'תיאור קצר של התהליך',
  steps: [
    { number: 1, title: 'שלב ראשון', detail: 'הסבר מפורט על השלב הראשון', icon: '1️⃣' },
    { number: 2, title: 'שלב שני', detail: 'הסבר מפורט על השלב השני', icon: '2️⃣' },
    { number: 3, title: 'שלב שלישי', detail: 'הסבר מפורט על השלב השלישי', icon: '3️⃣' }
  ],
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

const defaultComparisonProps: ComparisonProps = {
  title: 'השוואה',
  comparisonTitle: 'השוואה בין שני מושגים',
  itemA: {
    name: 'אפשרות א',
    description: 'תיאור של אפשרות א',
    icon: '🔵',
    attributes: {
      'מאפיין 1': 'ערך א1',
      'מאפיין 2': 'ערך א2',
      'מאפיין 3': 'ערך א3'
    }
  },
  itemB: {
    name: 'אפשרות ב',
    description: 'תיאור של אפשרות ב',
    icon: '🟢',
    attributes: {
      'מאפיין 1': 'ערך ב1',
      'מאפיין 2': 'ערך ב2',
      'מאפיין 3': 'ערך ב3'
    }
  },
  criteria: ['מאפיין 1', 'מאפיין 2', 'מאפיין 3'],
  direction: 'rtl',
  theme: 'light',
  brandColors: WIZDI_COLORS
};

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const width = 1920;
  const height = 1080;

  return (
    <>
      {/* Explainer Video - Animated concept explanations */}
      <Composition
        id="ExplainerVideo"
        component={ExplainerVideo}
        durationInFrames={getDurationInFrames('explainer', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultExplainerProps}
        schema={undefined}
      />

      {/* Math Visualization - Step-by-step math solutions */}
      <Composition
        id="MathVisualization"
        component={MathVisualization}
        durationInFrames={getDurationInFrames('math-visualization', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultMathProps}
        schema={undefined}
      />

      {/* Timeline Animation - Historical/process timelines */}
      <Composition
        id="TimelineAnimation"
        component={TimelineAnimation}
        durationInFrames={getDurationInFrames('timeline', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultTimelineProps}
        schema={undefined}
      />

      {/* Lesson Summary - Recap with achievements */}
      <Composition
        id="LessonSummary"
        component={LessonSummary}
        durationInFrames={getDurationInFrames('lesson-summary', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultSummaryProps}
        schema={undefined}
      />

      {/* Assignment Steps - Visual task instructions */}
      <Composition
        id="AssignmentSteps"
        component={AssignmentSteps}
        durationInFrames={getDurationInFrames('assignment-steps', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultAssignmentProps}
        schema={undefined}
      />

      {/* Objectives Intro - "What you'll learn" opener */}
      <Composition
        id="ObjectivesIntro"
        component={ObjectivesIntro}
        durationInFrames={getDurationInFrames('objectives-intro', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultObjectivesProps}
        schema={undefined}
      />

      {/* Vocabulary Flashcards - Animated term definitions */}
      <Composition
        id="VocabularyFlashcards"
        component={VocabularyFlashcards}
        durationInFrames={getDurationInFrames('vocabulary', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultVocabularyProps}
        schema={undefined}
      />

      {/* Process Steps - Numbered procedures */}
      <Composition
        id="ProcessSteps"
        component={ProcessSteps}
        durationInFrames={getDurationInFrames('process-steps', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultProcessProps}
        schema={undefined}
      />

      {/* Comparison - Side-by-side comparison */}
      <Composition
        id="Comparison"
        component={Comparison}
        durationInFrames={getDurationInFrames('comparison', fps)}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultComparisonProps}
        schema={undefined}
      />

      {/* Thumbnail stills for video previews */}
      <Still
        id="ExplainerThumbnail"
        component={ExplainerVideo}
        width={width}
        height={height}
        defaultProps={defaultExplainerProps}
      />

      <Still
        id="MathThumbnail"
        component={MathVisualization}
        width={width}
        height={height}
        defaultProps={defaultMathProps}
      />

      <Still
        id="TimelineThumbnail"
        component={TimelineAnimation}
        width={width}
        height={height}
        defaultProps={defaultTimelineProps}
      />

      <Still
        id="SummaryThumbnail"
        component={LessonSummary}
        width={width}
        height={height}
        defaultProps={defaultSummaryProps}
      />

      {/* New composition thumbnails */}
      <Still
        id="AssignmentThumbnail"
        component={AssignmentSteps}
        width={width}
        height={height}
        defaultProps={defaultAssignmentProps}
      />

      <Still
        id="ObjectivesThumbnail"
        component={ObjectivesIntro}
        width={width}
        height={height}
        defaultProps={defaultObjectivesProps}
      />

      <Still
        id="VocabularyThumbnail"
        component={VocabularyFlashcards}
        width={width}
        height={height}
        defaultProps={defaultVocabularyProps}
      />

      <Still
        id="ProcessThumbnail"
        component={ProcessSteps}
        width={width}
        height={height}
        defaultProps={defaultProcessProps}
      />

      <Still
        id="ComparisonThumbnail"
        component={Comparison}
        width={width}
        height={height}
        defaultProps={defaultComparisonProps}
      />
    </>
  );
};

export default RemotionRoot;
