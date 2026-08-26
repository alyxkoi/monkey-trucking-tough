import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      fontFamily: {
        heading: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      fontSize: {
        'h1': ['64px', { lineHeight: '1.05', letterSpacing: '0.02em' }],
        'h2': ['44px', { lineHeight: '1.1', letterSpacing: '0.02em' }],
        'h3': ['32px', { lineHeight: '1.15', letterSpacing: '0.01em' }],
        'h4': ['24px', { lineHeight: '1.2' }],
        'body': ['18px', { lineHeight: '1.6' }],
        'small': ['14px', { lineHeight: '1.5' }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        industrial: {
          DEFAULT: "hsl(var(--industrial))",
          foreground: "hsl(var(--industrial-foreground))",
        },
        gravel: {
          DEFAULT: "hsl(var(--gravel))",
          foreground: "hsl(var(--gravel-foreground))",
        },
        "light-gray": "hsl(var(--light-gray))",
        concrete: "#F4F2EE",
        asphalt: "#16161A",
        nearblack: "#0E0E10",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background, 0 0% 98%))",
          foreground: "hsl(var(--sidebar-foreground, 240 5.3% 26.1%))",
          primary: "hsl(var(--sidebar-primary, 240 5.9% 10%))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground, 0 0% 98%))",
          accent: "hsl(var(--sidebar-accent, 240 4.8% 95.9%))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, 240 5.9% 10%))",
          border: "hsl(var(--sidebar-border, 220 13% 91%))",
          ring: "hsl(var(--sidebar-ring, 217.2 91.2% 59.8%))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "lightbox-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.08)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "bounce-soft": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(8px)" },
        },
        "slide-up-in": {
          "0%": { transform: "translateY(120%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ken-burns": "ken-burns 22s ease-out forwards",
        marquee: "marquee 38s linear infinite",
        "bounce-soft": "bounce-soft 2.4s ease-in-out infinite",
        "slide-up-in": "slide-up-in 0.6s cubic-bezier(0.22,1,0.36,1) 0.4s both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
