import { useState, useEffect } from "react";

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("uc_theme", dark ? "dark" : "light");
}

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("uc_theme") === "dark");

  useEffect(() => { applyTheme(dark); }, [dark]);

  // Apply immediately on mount
  useEffect(() => { applyTheme(dark); }, []);

  return { dark, toggle: () => setDark(d => !d) };
}
