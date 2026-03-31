"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nibras.theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="iconButton"
      onClick={toggleTheme}
      aria-label={mounted ? `Switch to ${theme === "light" ? "dark" : "light"} theme` : "Toggle theme"}
      title={mounted ? `Theme: ${theme}` : "Toggle theme"}
    >
      {theme === "light" ? "◐" : "☀"}
    </button>
  );
}
