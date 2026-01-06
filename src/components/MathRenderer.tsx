/**
 * MathRenderer Component
 *
 * Renders markdown content with LaTeX math support using KaTeX.
 * Supports both inline math ($...$) and display math ($$...$$).
 *
 * Usage:
 *   <MathRenderer content="The equation $E=mc^2$ is famous." />
 *   <MathRenderer content="$$\frac{a}{b} = c$$" />
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  /** The content to render (markdown with optional LaTeX) */
  content: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom components for ReactMarkdown */
  components?: React.ComponentProps<typeof ReactMarkdown>['components'];
}

/**
 * Renders markdown content with math support
 */
export function MathRenderer({ content, className, components }: MathRendererProps) {
  // Memoize to avoid unnecessary re-renders
  const processedContent = useMemo(() => {
    if (!content) return '';
    return content;
  }, [content]);

  if (!processedContent) {
    return null;
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

/**
 * Renders inline math only (for use in text spans)
 */
export function InlineMath({ formula }: { formula: string }) {
  return (
    <MathRenderer
      content={`$${formula}$`}
      className="inline"
    />
  );
}

/**
 * Renders display (block) math
 */
export function DisplayMath({ formula }: { formula: string }) {
  return (
    <MathRenderer
      content={`$$${formula}$$`}
      className="block my-4"
    />
  );
}

/**
 * Hook to check if content contains math
 */
export function useHasMath(content: string): boolean {
  return useMemo(() => {
    if (!content) return false;
    // Check for LaTeX delimiters
    return /\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\\[[\s\S]+?\\]|\\([^\)]+?\\)/.test(content);
  }, [content]);
}

/**
 * Utility: Escape special LaTeX characters in user input
 */
export function escapeLatex(text: string): string {
  const specialChars = ['\\', '{', '}', '_', '^', '#', '&', '%', '$'];
  let escaped = text;
  for (const char of specialChars) {
    escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  }
  return escaped;
}

/**
 * Common math symbols for reference (can be used in UI)
 */
export const MATH_SYMBOLS = {
  // Basic operations
  plus: '+',
  minus: '−',
  times: '×',
  divide: '÷',
  equals: '=',
  notEquals: '≠',

  // Comparisons
  lessThan: '<',
  greaterThan: '>',
  lessOrEqual: '≤',
  greaterOrEqual: '≥',
  approx: '≈',

  // Fractions
  half: '½',
  third: '⅓',
  twoThirds: '⅔',
  quarter: '¼',
  threeQuarters: '¾',

  // Powers
  squared: '²',
  cubed: '³',
  power4: '⁴',

  // Greek letters (common in math)
  pi: 'π',
  alpha: 'α',
  beta: 'β',
  theta: 'θ',
  delta: 'Δ',
  sigma: 'Σ',

  // Other
  sqrt: '√',
  infinity: '∞',
  plusMinus: '±',
  degree: '°',
  percent: '%',
};

export default MathRenderer;
