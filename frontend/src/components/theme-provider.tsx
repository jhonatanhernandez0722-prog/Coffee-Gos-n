"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeName = "ocean" | "forest" | "sunset" | "berry" | "lavender" | "graphite" | "red" | "orange" | "gold" | "rose" | "midnight" | "mint";
type Theme = { name: ThemeName; label: string; colors: Record<string, string> };

export const themes: Theme[] = [
  { name: "ocean", label: "Océano", colors: { "--blue-main": "#087ea4", "--blue-secondary": "#0f766e", "--blue-light": "#cffafe", "--ink": "#083344", "--muted": "#4b6470", "--line": "#b7d7dc", "--canvas": "#ecfeff" } },
  { name: "forest", label: "Bosque", colors: { "--blue-main": "#34745c", "--blue-secondary": "#1f6048", "--blue-light": "#dcefe3", "--ink": "#193b2d", "--muted": "#557267", "--line": "#b8d2c1", "--canvas": "#f0f7f2" } },
  { name: "sunset", label: "Atardecer", colors: { "--blue-main": "#c45b36", "--blue-secondary": "#a8442c", "--blue-light": "#ffe1d4", "--ink": "#4a231a", "--muted": "#76584d", "--line": "#e5b8a7", "--canvas": "#fff7f3" } },
  { name: "berry", label: "Frambuesa", colors: { "--blue-main": "#a33d68", "--blue-secondary": "#7d2f55", "--blue-light": "#f7d9e5", "--ink": "#451d31", "--muted": "#76566a", "--line": "#dfb5c7", "--canvas": "#fff5f8" } },
  { name: "lavender", label: "Lavanda", colors: { "--blue-main": "#7657a6", "--blue-secondary": "#5c4384", "--blue-light": "#e9def8", "--ink": "#302248", "--muted": "#6b607b", "--line": "#cdbce3", "--canvas": "#faf8ff" } },
  { name: "graphite", label: "Grafito", colors: { "--blue-main": "#526879", "--blue-secondary": "#394c59", "--blue-light": "#dce7ed", "--ink": "#1f2d35", "--muted": "#62737c", "--line": "#bdcbd2", "--canvas": "#f3f6f7" } },
  { name: "red", label: "Rojo", colors: { "--blue-main": "#b42318", "--blue-secondary": "#8f1d14", "--blue-light": "#fee4e2", "--ink": "#461b18", "--muted": "#76504c", "--line": "#e8b4ae", "--canvas": "#fff8f7" } },
  { name: "orange", label: "Naranja", colors: { "--blue-main": "#c2410c", "--blue-secondary": "#9a3412", "--blue-light": "#ffedd5", "--ink": "#431407", "--muted": "#795548", "--line": "#f2c29f", "--canvas": "#fffaf5" } },
  { name: "gold", label: "Dorado", colors: { "--blue-main": "#a16207", "--blue-secondary": "#854d0e", "--blue-light": "#fef3c7", "--ink": "#422006", "--muted": "#75613b", "--line": "#e7cf8d", "--canvas": "#fffcf2" } },
  { name: "rose", label: "Rosa", colors: { "--blue-main": "#be185d", "--blue-secondary": "#9d174d", "--blue-light": "#fce7f3", "--ink": "#500724", "--muted": "#80516a", "--line": "#edb7d0", "--canvas": "#fff7fb" } },
  { name: "midnight", label: "Azul noche", colors: { "--blue-main": "#1d4ed8", "--blue-secondary": "#1e3a8a", "--blue-light": "#dbeafe", "--ink": "#172554", "--muted": "#536785", "--line": "#b6c9ec", "--canvas": "#f5f8ff" } },
  { name: "mint", label: "Menta", colors: { "--blue-main": "#047857", "--blue-secondary": "#065f46", "--blue-light": "#d1fae5", "--ink": "#022c22", "--muted": "#50756a", "--line": "#add8c7", "--canvas": "#f3fcf8" } },
];

const ThemeContext = createContext<{ theme: ThemeName; setTheme: (theme: ThemeName) => void }>({ theme: "ocean", setTheme: () => undefined });

function accountKey() {
  try {
    const user = JSON.parse(sessionStorage.getItem("coffee_gosen_user") ?? "null") as { id?: number; email?: string } | null;
    return user?.id ? String(user.id) : user?.email ?? "guest";
  } catch { return "guest"; }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "ocean";
    const saved = localStorage.getItem(`coffee_gosen_theme_${accountKey()}`) as ThemeName | null;
    return themes.some((item) => item.name === saved) ? saved as ThemeName : "ocean";
  });
  function loadAccountTheme() {
    const saved = localStorage.getItem(`coffee_gosen_theme_${accountKey()}`) as ThemeName | null;
    setThemeState(themes.some((item) => item.name === saved) ? saved as ThemeName : "ocean");
  }
  useEffect(() => {
    window.addEventListener("coffee-gosen-auth", loadAccountTheme);
    return () => window.removeEventListener("coffee-gosen-auth", loadAccountTheme);
  }, []);
  useEffect(() => {
    const selected = themes.find((item) => item.name === theme) ?? themes[0];
    Object.entries(selected.colors).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function setTheme(nextTheme: ThemeName) { setThemeState(nextTheme); localStorage.setItem(`coffee_gosen_theme_${accountKey()}`, nextTheme); }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
