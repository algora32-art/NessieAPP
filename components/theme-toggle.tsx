"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light"|"dark">("light");

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return <Button variant="ghost" onClick={toggle} title="Cambiar tema">{theme === "dark" ? "🌙 Oscuro" : "☀️ Claro"}</Button>;
}
