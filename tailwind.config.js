/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        bg: '#0A0D1C',
        panel: '#12162B',
        panel2: '#171C38',
        border: '#272E52',
        ink: '#E9E7F0',
        'ink-dim': '#8B92B8',
        fire: { DEFAULT: '#E4463A', glow: '#FF6A52' },
        water: { DEFAULT: '#2FA0E0', glow: '#5CC2FF' },
        wind: { DEFAULT: '#E7C22E', glow: '#FFDE4D' },
        light: { DEFAULT: '#EAEBF0', glow: '#FFFFFF' },
        dark: { DEFAULT: '#A15FE0', glow: '#C48CFF' },
        unknown: { DEFAULT: '#5B6280', glow: '#8890B8' },
        star: '#F2C24C',
      },
      boxShadow: {
        glow: '0 8px 24px -8px var(--tw-shadow-color)',
      },
    },
  },
  plugins: [],
};
