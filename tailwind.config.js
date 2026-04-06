/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  safelist: [
    "bg-brand", "text-brand", "border-brand",
    "font-jakarta", "font-mono2",
  ],
  theme: {
    extend: {
      fontFamily: {
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
        mono2: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        pill: '100px',
        card: '24px',
        inner: '14px',
        lg: '14px',
        md: '10px',
        sm: '8px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(13,27,42,0.06)',
        'card-hover': '0 6px 24px rgba(13,27,42,0.10)',
        modal: '0 20px 60px rgba(13,27,42,0.18)',
        dropdown: '0 8px 30px rgba(13,27,42,0.10)',
        tooltip: '0 4px 12px rgba(0,0,0,0.15)',
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--card)',
        ink: 'var(--ink)',
        muted2: 'var(--muted)',
        subtle: 'var(--subtle)',
        divider: 'var(--divider)',
        brand: {
          DEFAULT: 'hsl(var(--accent-brand))',
          foreground: 'hsl(var(--accent-brand-foreground))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card-hsl))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted-hsl))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border-hsl))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': '#2A69FF',
          '2': 'rgba(42,105,255,0.70)',
          '3': 'rgba(42,105,255,0.50)',
          '4': 'rgba(42,105,255,0.30)',
          '5': 'rgba(42,105,255,0.15)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          primary: 'hsl(var(--primary))',
          'primary-foreground': 'hsl(var(--primary-foreground))',
          accent: 'hsl(var(--accent))',
          'accent-foreground': 'hsl(var(--accent-foreground))',
          border: 'hsl(var(--border-hsl))',
          ring: 'hsl(var(--ring))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.3s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};