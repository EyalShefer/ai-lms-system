/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Enable Dark Mode with class strategy
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Rubik"', 'sans-serif'],
      },
      colors: {
        // --- Wizdi Brand Palette (v2.0 - Violet Action) ---
        wizdi: {
          // Primary
          royal: '#2B59C3',       // Headers, primary text
          'royal-dark': '#1e40af', // Darker for contrast
          'royal-light': '#E0E7FF', // Light backgrounds

          // Secondary
          cyan: '#00C2FF',        // Highlights, focus rings
          'cyan-dark': '#0891B2',
          'cyan-light': '#ECFEFF',

          // Action (NEW - Violet palette replacing lime)
          action: '#8B5CF6',       // violet-500 - Primary CTA
          'action-hover': '#7C3AED', // violet-600
          'action-active': '#6D28D9', // violet-700
          'action-dark': '#5B21B6',  // violet-800 - 3D shadow
          'action-light': '#EDE9FE', // violet-100
          'action-lighter': '#F5F3FF', // violet-50

          // Gamification
          gold: '#FFD500',
          'gold-dark': '#CA8A04',
          'gold-light': '#FEF9C3',

          // Backgrounds
          cloud: '#F5F9FF',
          white: '#FFFFFF',

          // Legacy (keeping for backward compatibility, maps to violet)
          lime: '#8B5CF6',        // Now maps to action (violet)
        },

        // Semantic colors
        success: {
          DEFAULT: '#22C55E',
          light: '#DCFCE7',
        },
        error: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },

        // Backward Compatibility Maps
        indigo: {
          50: '#F5F9FF',
          100: '#e0f2fe',
          500: '#2B59C3',
          600: '#1a45a0',
          700: '#0A4D7F',
          900: '#063254',
        },
        // Purple now correctly maps to violet
        purple: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
        },
        blue: {
          50: '#eff6ff',
          500: '#2B59C3',
          600: '#1e40af',
        },
        // Violet (new action color)
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
      },

      // Z-Index Scale (consistent hierarchy)
      zIndex: {
        'dropdown': '10',
        'sticky': '20',
        'fixed': '30',
        'modal-backdrop': '40',
        'modal': '50',
        'popover': '60',
        'tooltip': '70',
        'toast': '80',
      },

      // Spacing (with touch target sizes)
      spacing: {
        'touch': '44px',       // Minimum touch target
        'touch-sm': '36px',    // Small touch target
      },

      borderRadius: {
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        'pill': '9999px',
      },

      boxShadow: {
        'glass': '0 8px 32px 0 rgba(43, 89, 195, 0.1)',
        'glow': '0 0 15px rgba(0, 194, 255, 0.4)',
        'glow-violet': '0 0 15px rgba(139, 92, 246, 0.4)',
        // 3D shadows for action buttons (violet)
        '3d': '0 6px 0 0 #5B21B6',
        '3d-hover': '0 4px 0 0 #5B21B6',
        '3d-active': '0 2px 0 0 #5B21B6',
        // Legacy (keeping for backward compat)
        '3d-green': '0 6px 0 0 #65A30D',
      },

      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,249,255,0.8) 100%)',
        // Gradient for action buttons
        'action-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      },

      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseViolet: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.7)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(139, 92, 246, 0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(139, 92, 246, 0)' },
        },
        // Keep old animation for backward compat
        pulseGreen: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.7)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(74, 222, 128, 0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        pop: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-violet': 'pulseViolet 1s infinite',
        'pulse-green': 'pulseGreen 1s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'pop': 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'float': 'float 4s ease-in-out infinite',
        'blob': 'blob 7s infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },

      // Min heights for touch targets
      minHeight: {
        'touch': '44px',
        'touch-sm': '36px',
      },

      // Min widths for touch targets
      minWidth: {
        'touch': '44px',
        'touch-sm': '36px',
      },
    },
  },
  plugins: [],
}
