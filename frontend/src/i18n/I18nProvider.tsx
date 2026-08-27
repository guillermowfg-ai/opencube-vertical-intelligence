/**
 * Provides the chosen language to the tree, and remembers it per browser.
 *
 * Kept in its own module so `src/i18n/index.ts` exports only helpers -- a
 * module that exports both a component and functions breaks fast refresh.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DICTIONARIES,
  I18nContext,
  LOCALES,
  STORAGE_KEY,
  type I18nValue,
  type Language,
} from "./context";

function readStored(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "es" ? value : null;
  } catch {
    // Private windows and blocked site data throw on access itself. Someone
    // who cannot store a preference still gets a working UI.
    return null;
  }
}

function detect(): Language {
  const stored = readStored();
  if (stored) return stored;
  const preferred = typeof navigator !== "undefined" ? (navigator.languages ?? []) : [];
  for (const tag of preferred) {
    if (tag.toLowerCase().startsWith("es")) return "es";
    if (tag.toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detect);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting the preference is a convenience; failing to do so must
      // never break the switch itself.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      locale: LOCALES[language],
      t: DICTIONARIES[language],
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
