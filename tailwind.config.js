/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-secondary": "var(--color-surface-secondary)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        "accent-warm": "var(--color-accent-warm)",
        "text-primary": "var(--color-text-primary)",
        "text-muted": "var(--color-text-muted)",
      },
      screens: {
        'tablet': '960px',
        '4k': '2560px',
      },
      fontWeight: {
        'heavy': '800',
        'black': '900',
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.03em',
      },
      maxWidth: {
        'content': 'clamp(520px, 70%, 1300px)',
      },
      animation: {
        'ring-pulse': 'ring-pulse 0.5s ease-out forwards',
        'check-draw': 'check-draw 0.3s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.8s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
