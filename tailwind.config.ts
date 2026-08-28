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
        display: ['Anton', 'Impact', 'Haettenschweiler', 'sans-serif'],
        label: ['"Barlow Semi Condensed"', 'Barlow', 'Inter', 'system-ui', 'sans-serif'],
        "control-body": ['Barlow', 'Inter', 'system-ui', 'sans-serif'],
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
        canvas: "#0E0E10",
        panel: "#17171A",
        raised: "#212126",
        line: "rgba(255,255,255,0.08)",
        ink: "#F5F5F7",
        "cc-muted": "#9C9CA6",
        idle: "#8A8A94",
        platinum: {
          ink: "#171A1F",
          muted: "#444A52",
          idle: "#656C74",
        },
        mt: {
          red: "#FF3131",
          deep: "#D62D24",
          tint: "#2A1214",
        },
        ice: {
          DEFAULT: "#B7FF35",
          deep: "#8ED31C",
          tint: "#17230F",
          violet: "#4F95FF",
        },
        ok: "#30D158",
        warn: "#FF9F0A",
        inactive: "#5A5A61",
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
        panel: "18px",
        block: "22px",
      },
      boxShadow: {
        surface: "0 1px 0 0 rgba(255,255,255,0.045) inset, 0 18px 40px -24px rgba(0,0,0,0.9)",
        lifted: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 30px 60px -30px rgba(0,0,0,0.95)",
        solid: "0 24px 60px -32px rgba(0,0,0,0.85)",
      },
      maxWidth: {
        shell: "1760px",
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
