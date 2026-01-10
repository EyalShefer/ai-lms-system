import React, { useEffect, useState } from 'react';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeToggleProps {
  /** Size of the toggle */
  size?: 'sm' | 'md' | 'lg';
  /** Show labels */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Theme Toggle Component
 *
 * Features:
 * - Light/Dark/System modes
 * - Persists preference to localStorage
 * - Respects system preference
 * - Accessible with keyboard navigation
 *
 * @example
 * ```tsx
 * <ThemeToggle size="md" showLabel />
 * ```
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  // Size styles
  const sizeStyles: Record<typeof size, { button: string; icon: number }> = {
    sm: { button: 'min-h-[36px] px-2', icon: 16 },
    md: { button: 'min-h-[44px] px-3', icon: 20 },
    lg: { button: 'min-h-[52px] px-4', icon: 24 },
  };

  // Initialize theme from localStorage or system
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('wizdi-theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      setTheme('system');
      applyTheme('system');
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme to document
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.toggle('dark', isDark);
  };

  // Handle theme change
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('wizdi-theme', newTheme);
    applyTheme(newTheme);
  };

  // Cycle through themes
  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    handleThemeChange(themes[nextIndex]);
  };

  // Get current icon
  const getCurrentIcon = () => {
    const iconSize = sizeStyles[size].icon;
    switch (theme) {
      case 'light':
        return <IconSun size={iconSize} />;
      case 'dark':
        return <IconMoon size={iconSize} />;
      default:
        return <IconDeviceDesktop size={iconSize} />;
    }
  };

  // Get label text
  const getLabelText = () => {
    switch (theme) {
      case 'light':
        return 'מצב בהיר';
      case 'dark':
        return 'מצב כהה';
      default:
        return 'מערכת';
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className={`
          ${sizeStyles[size].button}
          flex items-center gap-2
          rounded-full
          bg-slate-100 dark:bg-slate-800
          text-slate-500
          ${className}
        `}
        aria-label="טוען מצב תצוגה..."
        disabled
      >
        <IconSun size={sizeStyles[size].icon} className="opacity-50" />
      </button>
    );
  }

  return (
    <button
      onClick={cycleTheme}
      className={`
        ${sizeStyles[size].button}
        flex items-center gap-2
        rounded-full
        bg-slate-100 hover:bg-slate-200
        dark:bg-slate-800 dark:hover:bg-slate-700
        text-wizdi-royal dark:text-white
        transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wizdi-cyan
        ${className}
      `}
      aria-label={`מצב תצוגה נוכחי: ${getLabelText()}. לחץ כדי לשנות`}
      title={getLabelText()}
    >
      {getCurrentIcon()}
      {showLabel && (
        <span className="text-sm font-medium">{getLabelText()}</span>
      )}
    </button>
  );
};

/**
 * useTheme Hook - For programmatic theme access
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('wizdi-theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Resolve actual theme
    const isDark =
      savedTheme === 'dark' ||
      (savedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setResolvedTheme(isDark ? 'dark' : 'light');
  }, []);

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('wizdi-theme', newTheme);

    const root = document.documentElement;
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.toggle('dark', isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
  };

  return { theme, setTheme: setThemeValue, resolvedTheme };
};

export default ThemeToggle;
