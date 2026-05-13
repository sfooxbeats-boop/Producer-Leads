/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // App color palette — dark music theme
        bg: '#0A0A0A',
        card: '#1A1A1A',
        border: '#2A2A2A',
        accent: '#8B5CF6',      // purple — the main action color
        'accent-dark': '#6D28D9',
        muted: '#6B7280',
      },
    },
  },
  plugins: [],
};
