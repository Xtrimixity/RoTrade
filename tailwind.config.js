/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src**/*.{html,js}"],
    theme: {
      extend: {
        colors: {
          theme: 'var(--rv-accent, #EA580C)',
          lightTheme: "var(--rv-accent-2, #FB923C)",
          secondary:"#475569"
        },
        boxShadow: {
          'lg': 'rgba(99, 99, 99, 0.2) 0px 2px 8px 0px',
        }
      },
    },
    plugins: [require("daisyui")],
    daisyui: {
      themes: [
        {
          mytheme: {
            primary: "#EA580C",
            secondary: "#475569",
            "base-100": "#ffffff",
            neutral: "#3d4451",
          }
        },
      ]
    }
  }
  
