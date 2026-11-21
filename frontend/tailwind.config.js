/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0e1f2f',
          800: '#142a3e',
          700: '#1c364e',
        },
        vaadateal: {
          DEFAULT: '#0f766e',
          hover: '#115e59',
          light: '#ccfbf1',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
