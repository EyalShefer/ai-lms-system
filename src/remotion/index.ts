/**
 * Remotion Entry Point
 * Registers the root component for Remotion CLI
 */

import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);

// Re-export types for use in other parts of the application
export * from './types/composition.types';

// Re-export compositions for direct use
export { ExplainerVideo } from './compositions/ExplainerVideo';
export { MathVisualization } from './compositions/MathVisualization';
export { TimelineAnimation } from './compositions/TimelineAnimation';
export { LessonSummary } from './compositions/LessonSummary';

// Re-export components for building custom compositions
export { AnimatedText } from './components/AnimatedText';
export { MathFormula, EquationSteps, AnimatedNumber } from './components/MathFormula';
export { Transition, Scene, BackgroundShape } from './components/Transitions';

// Re-export utilities
export { colors, gradients } from './utils/colors';
export { fonts, fontWeights, loadFonts, getHebrewTextStyle } from './utils/fonts';
