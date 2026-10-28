"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COOKIE = "theme";
// 1 year — long enough to survive normal sessions; the user can re-toggle
// any time and we rewrite the cookie.
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeThemeCookie(theme: Theme) {
  // Cookie is the source of truth: it's read by the root layout server-side
  // so SSR emits <html class="dark"> without any client-side reconciliation.
  // SameSite=Lax is fine — theme isn't sensitive.
  document.cookie =
    `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  // Seed React state from the same value the server used for SSR — keeps
  // hydration consistent and avoids a re-render flash.
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const applyTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    writeThemeCookie(next);
    try {
      // Mirror to localStorage for backwards compatibility / first-paint
      // bootstrap if the cookie ever fails to be set.
      localStorage.setItem(THEME_COOKIE, next);
    } catch {
      // localStorage may be unavailable (private mode); ignore.
    }
  }, []);

  const value: ThemeContextValue = {
    theme,
    setTheme: applyTheme,
    toggle: () => applyTheme(theme === "dark" ? "light" : "dark"),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * First-paint bootstrap for users without a `theme` cookie yet (e.g. their
 * very first visit). Falls back to the OS preference and immediately
 * mirror-writes a cookie so subsequent SSRs render the right class. After
 * the first toggle, the cookie alone drives everything.
 */
export const themeBootstrapScript = `
  (function () {
    try {
      var m = document.cookie.match(/(?:^|; )theme=(dark|light)/);
      if (m) return;
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var t = prefersDark ? 'dark' : 'light';
      if (t === 'dark') document.documentElement.classList.add('dark');
      document.cookie = 'theme=' + t + '; path=/; max-age=' + (60*60*24*365) + '; SameSite=Lax';
    } catch (e) {}
  })();
`;
