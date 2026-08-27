/**
 * Language state, shared by every screen.
 *
 * The dictionaries are plain objects, not a runtime i18n library: the copy is
 * finite, both languages ship in the bundle, and `Dictionary` makes a missing
 * Spanish key a compile error rather than an English string leaking into a
 * Spanish screen.
 *
 * The chosen language also drives `Intl` — dates, numbers and relative times
 * all follow it, so a Spanish UI never renders "3 days ago".
 */

import { createContext, useContext } from "react";
import { en, type Dictionary } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

export const DICTIONARIES: Record<Language, Dictionary> = { en, es };
export const LOCALES: Record<Language, string> = { en: "en-US", es: "es-419" };
export const STORAGE_KEY = "opencube-intel.language";

export interface I18nValue {
  language: Language;
  locale: string;
  t: Dictionary;
  setLanguage: (language: Language) => void;
}

export const I18nContext = createContext<I18nValue | null>(null);



export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** Fills `{name}` placeholders. Values are rendered as text, never as HTML. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
