/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#111111",
        accent: "#8b0000",
        text: "#c9c9c9",
        highlight: "#ff3333",
      },
    },
  },
  plugins: [],
};
