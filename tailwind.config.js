/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        status: {
          applied: '#64748b',
          oa: '#0ea5e9',
          round1: '#6366f1',
          round2: '#8b5cf6',
          final: '#d946ef',
          offer: '#16a34a',
          reject: '#dc2626',
          ghosted: '#a16207',
        },
      },
    },
  },
  plugins: [],
}
