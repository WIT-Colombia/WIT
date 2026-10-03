import { useEffect, useState } from "react";

export type Language = "es" | "en";
const KEY = "wit-language";
export function getLanguage(): Language { return localStorage.getItem(KEY) === "en" ? "en" : "es"; }
export function setLanguage(language: Language): void { localStorage.setItem(KEY, language); document.documentElement.lang = language; window.dispatchEvent(new Event("wit-language-change")); }
export function useLanguage(): Language {
  const [language, setCurrent] = useState<Language>(getLanguage);
  useEffect(() => { const update = () => setCurrent(getLanguage()); window.addEventListener("wit-language-change", update); return () => window.removeEventListener("wit-language-change", update); }, []);
  return language;
}
