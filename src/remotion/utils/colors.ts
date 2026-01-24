/**
 * Wizdi Brand Colors for Remotion
 * Exported from tailwind.config.js for use in video compositions
 */

export const colors = {
  // Primary
  wizdiRoyal: '#2B59C3',
  wizdiRoyalDark: '#1e40af',
  wizdiRoyalLight: '#E0E7FF',

  // Secondary (Cyan)
  wizdiCyan: '#00C2FF',
  wizdiCyanDark: '#0891B2',
  wizdiCyanLight: '#ECFEFF',

  // Action (Violet)
  wizdiAction: '#8B5CF6',
  wizdiActionHover: '#7C3AED',
  wizdiActionActive: '#6D28D9',
  wizdiActionDark: '#5B21B6',
  wizdiActionLight: '#EDE9FE',

  // Gamification
  wizdiGold: '#FFD500',
  wizdiGoldDark: '#CA8A04',
  wizdiGoldLight: '#FEF9C3',

  // Backgrounds
  wizdiCloud: '#F5F9FF',
  wizdiWhite: '#FFFFFF',

  // Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  // Violet scale
  violet: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Text colors
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
} as const;

// Gradient definitions for Remotion
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.wizdiRoyal} 0%, ${colors.wizdiRoyalDark} 100%)`,
  action: `linear-gradient(135deg, ${colors.wizdiAction} 0%, ${colors.wizdiActionHover} 100%)`,
  cyan: `linear-gradient(135deg, ${colors.wizdiCyan} 0%, ${colors.wizdiCyanDark} 100%)`,
  gold: `linear-gradient(135deg, ${colors.wizdiGold} 0%, ${colors.wizdiGoldDark} 100%)`,
  heroBackground: `linear-gradient(135deg, ${colors.wizdiCloud} 0%, ${colors.wizdiRoyalLight} 100%)`,
};

export default colors;
