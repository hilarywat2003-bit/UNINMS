import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#edfaf2', 100: '#d2f4e2', 200: '#a8e8c7',
          300: '#71d5a4', 400: '#38ba7d', 500: '#1a9e61',
          600: '#0d7f4d', 700: '#0a6640', 800: '#0a5235',
          900: '#09432c', 950: '#042518',
        },
        gold: {
          50: '#fdfae9', 100: '#faf3c6', 400: '#e2b825',
          500: '#d09b10', 600: '#a8780b', 700: '#87590d',
        },
        stone: {
          50: '#fafaf8', 100: '#f4f3f0', 200: '#e8e6e1',
          300: '#d4d1ca', 400: '#b5b0a7', 500: '#928d82',
          600: '#787167', 700: '#625d54', 800: '#524e47',
          900: '#46433d', 950: '#26231f',
        },
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-md':'0 4px 6px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)',
        green:   '0 4px 20px rgba(10,82,53,0.25)',
      },
    },
  },
  plugins: [],
};
export default config;
