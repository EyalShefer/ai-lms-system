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
        // --- דריסת צבעי המערכת הישנים לצבעי המותג החדש ---

        // כל מה שהיה אינדיגו (הצבע הראשי) יהפוך לכחול-Wizdi
        indigo: {
          50: '#f0f9ff', // רקע בהיר
          100: '#e0f2fe',
          500: '#24A8D9', // הכחול הראשי
          600: '#1c90be', // כחול כהה יותר (להובר)
          700: '#0A4D7F', // הכחול הכהה (לטקסט)
          900: '#063254',
        },

        // כל מה שהיה סגול (כפתורי פעולה/הדגשה) יהפוך לכתום-Wizdi
        purple: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#F49E2E', // הכתום של הרגליים/מקור
          600: '#ea8a1a',
          700: '#c2410c',
        },

        // צבעי Wizdi מפורשים (לשימוש עתידי)
        wizdi: {
          light: '#B8D6F6', // תכלת בטן
          blue: '#24A8D9',  // כחול גוף
          dark: '#0A4D7F',  // כחול כנפיים
          orange: '#F49E2E', // כתום
        }
      },
      boxShadow: {
        // צל זכוכית לכרטיסים
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
        // צל זוהר לכפתורים
        'glow': '0 0 15px rgba(36, 168, 217, 0.4)',
      },
      backgroundImage: {
        // הגרדיאנט הכללי
        'glass-gradient': 'linear-gradient(135deg, #f5faff 0%, #dbeafe 100%)',
      }
    },
  },
  plugins: [],
}