/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Rubik"', 'sans-serif'],
      },
      colors: {
        // --- wizdi Brand Palette (Duolingo-Style) ---
        wizdi: {
          royal: '#2B59C3', // Brand Primary (Headers, Text)
          cyan: '#00C2FF',  // Brand Secondary (Highlights)
          lime: '#8CE81C',  // ACTION Primary (Buttons - The "Pop")
          gold: '#FFD500',  // Gamification (Stars, Streaks)
          cloud: '#F5F9FF', // Background (Soft)
          white: '#FFFFFF', // Surface
        },

        // Backward Compatibility Maps (Slowly deprecating)
        indigo: {
          50: '#F5F9FF', // cloud
          100: '#e0f2fe',
          500: '#2B59C3', // royal
          600: '#1a45a0', // Darker royal
          700: '#0A4D7F',
          900: '#063254',
        },
        // Mapping "Purple" (Old Action) to "Lime" (New Action) for instant facelift
        purple: {
          50: '#f7fee7',
          100: '#ecfccb',
          500: '#8CE81C', // wizdi-lime
          600: '#65a30d', // lime-600
          700: '#4d7c0f',
        },
        blue: {
          50: '#eff6ff',
          500: '#2B59C3', // Default blue is now Royal
          600: '#1e40af',
        }
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        'pill': '9999px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(43, 89, 195, 0.1)', // Royal tint
        'glow': '0 0 15px rgba(0, 194, 255, 0.4)', // Cyan glow
        '3d': '0 6px 0 0 #65A30D', // 3D Button Shadow (Green)
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,249,255,0.8) 100%)',
      }
    },
  },
  plugins: [],
}