/**
 * Wizdi Design Tokens
 * Central source of truth for colors, spacing, shadows, and z-index
 */

// =============================================================================
// COLORS
// =============================================================================

export const colors = {
  brand: {
    // Primary brand colors
    royal: '#2B59C3',        // Headers, primary text, links
    royalDark: '#1e40af',    // Darker royal for contrast
    royalLight: '#E0E7FF',   // Light royal for backgrounds

    // Secondary - cyan for highlights
    cyan: '#00C2FF',         // Highlights, hover states, focus rings
    cyanDark: '#0891B2',     // Darker cyan
    cyanLight: '#ECFEFF',    // Light cyan backgrounds

    // Action - NEW VIOLET PALETTE (replacing lime)
    action: '#8B5CF6',       // violet-500 - Primary CTA buttons
    actionHover: '#7C3AED',  // violet-600 - Hover state
    actionActive: '#6D28D9', // violet-700 - Active/pressed state
    actionDark: '#5B21B6',   // violet-800 - 3D shadow, dark text
    actionLight: '#EDE9FE',  // violet-100 - Light backgrounds
    actionLighter: '#F5F3FF', // violet-50 - Very light backgrounds

    // Gamification
    gold: '#FFD500',         // Stars, streaks, achievements
    goldDark: '#CA8A04',     // Darker gold for text
    goldLight: '#FEF9C3',    // Light gold backgrounds

    // Backgrounds
    cloud: '#F5F9FF',        // Main background
    white: '#FFFFFF',        // Surface/card background
  },

  // Semantic colors
  semantic: {
    success: '#22C55E',      // green-500
    successLight: '#DCFCE7', // green-100
    error: '#EF4444',        // red-500
    errorLight: '#FEE2E2',   // red-100
    warning: '#F59E0B',      // amber-500
    warningLight: '#FEF3C7', // amber-100
    info: '#3B82F6',         // blue-500
    infoLight: '#DBEAFE',    // blue-100
  },

  // Dark mode colors
  dark: {
    bg: '#0F172A',           // slate-900
    surface: '#1E293B',      // slate-800
    surfaceHover: '#334155', // slate-700
    border: '#475569',       // slate-600
    text: '#F8FAFC',         // slate-50
    textMuted: '#94A3B8',    // slate-400
  },
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  maximum: 9999,
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  // Touch target minimum (Apple/Google guidelines)
  touchTarget: '44px',
  touchTargetSm: '36px',    // Minimum for less critical elements

  // Common spacing values
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  // Glass morphism shadow
  glass: '0 8px 32px 0 rgba(43, 89, 195, 0.1)',

  // Glow effects
  glowCyan: '0 0 15px rgba(0, 194, 255, 0.4)',
  glowViolet: '0 0 15px rgba(139, 92, 246, 0.4)',

  // 3D button shadows
  '3d': '0 6px 0 0 #5B21B6',        // violet-800 for action buttons
  '3dHover': '0 4px 0 0 #5B21B6',   // Compressed on hover
  '3dActive': '0 2px 0 0 #5B21B6',  // More compressed on active

  // Elevation shadows
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
} as const;

// =============================================================================
// ANIMATION TIMING
// =============================================================================

export const animation = {
  // Durations
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',

  // Easings
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    sans: '"Rubik", sans-serif',
    mono: '"Fira Code", monospace',
  },
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Colors = typeof colors;
export type ZIndex = typeof zIndex;
export type Spacing = typeof spacing;
export type Shadows = typeof shadows;
export type BorderRadius = typeof borderRadius;
export type Animation = typeof animation;
export type Typography = typeof typography;
export type Breakpoints = typeof breakpoints;
