/**
 * Math Components Library
 *
 * Components for elementary school math education:
 * - FractionInput: Input for fractions (numerator/denominator)
 * - MathKeyboard: Virtual keyboard with math symbols
 * - GeometryShapes: SVG geometric shapes with labels
 *
 * Usage:
 *   import { FractionInput, MathKeyboard, Rectangle, Circle } from './components/math';
 */

// Fraction Input Components
export {
  FractionInput,
  MixedNumberInput,
  fractionToDecimal,
  fractionToString,
  parseFraction,
  type FractionValue,
} from './FractionInput';

// Math Keyboard Components
export {
  MathKeyboard,
  InlineMathKeyboard,
  NumberPad,
} from './MathKeyboard';

// Geometry Shapes
export {
  Rectangle,
  Triangle,
  Circle,
  Angle,
  ShapeGallery,
} from './GeometryShapes';

// Re-export MathRenderer from parent
export { MathRenderer, InlineMath, DisplayMath, useHasMath, MATH_SYMBOLS } from '../MathRenderer';
