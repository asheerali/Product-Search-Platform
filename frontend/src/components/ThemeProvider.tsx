"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "light", toggle: () => {} });

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

// Inline script injected into <head> so the correct theme class is applied
// before hydration — avoids a flash of the wrong theme on load.
// Defaults to light regardless of OS preference; only an explicit stored
// choice (via the toggle) switches to dark.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var dark = localStorage.getItem("theme") === "dark";
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
