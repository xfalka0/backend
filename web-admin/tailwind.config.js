/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                purple: {
                    400: '#a78bfa', // Light purple
                    500: '#8b5cf6', // Primary purple
                    600: '#7c3aed', // Dark purple
                    900: '#4c1d95', // Deep purple
                },
                dark: {
                    800: '#1f2937', // Panel bg
                    900: '#111827', // Main bg
                }
            }
        },
    },
    plugins: [],
}
