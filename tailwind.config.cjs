/** @type {import('tailwindcss').Config} */

// Colors are driven by CSS variables (see globals.css) so themes can be
// switched on the fly by setting `data-theme` on <html>. Each variable holds
// an "R G B" channel triplet so Tailwind's /opacity modifiers keep working.
function themed(variable) {
    return `rgb(var(${variable}) / <alpha-value>)`;
}

module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                // "canvas" = the app background. Named to avoid clashing with
                // Tailwind's core `text-base` font-size utility.
                canvas: themed("--c-base"),
                surface: themed("--c-surface"),
                elevated: themed("--c-elevated"),
                topbar: themed("--c-topbar"),
                border: themed("--c-border"),
                accent: themed("--c-accent"),
                "accent-soft": themed("--c-accent-soft"),
                maintext: themed("--c-text"),
                subtext: themed("--c-subtext")
            },
            fontFamily: {
                unbounded: ["Unbounded", "Verdana", "sans-serif"]
            },
            transitionTimingFunction: {
                smooth: "cubic-bezier(0.4, 0, 0.2, 1)"
            }
        }
    },
    plugins: []
};
