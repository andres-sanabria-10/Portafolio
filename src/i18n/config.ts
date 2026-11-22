/**
 * Configuración de idiomas. Es la única fuente de verdad: la usan
 * `astro.config.ts`, los helpers de `utils.ts` y los componentes.
 */
export const locales = ['es', 'en'] as const;

export type Lang = (typeof locales)[number];

/** El idioma por defecto se sirve en `/`, sin prefijo. */
export const defaultLang: Lang = 'es';

interface LocaleMeta {
  /** Nombre del idioma escrito en ese idioma. */
  label: string;
  /** Valor para el atributo `lang` y para `hreflang`. */
  htmlLang: string;
  /** Valor para `og:locale`. */
  ogLocale: string;
}

export const localeMeta: Record<Lang, LocaleMeta> = {
  es: { label: 'Español', htmlLang: 'es', ogLocale: 'es_CO' },
  en: { label: 'English', htmlLang: 'en', ogLocale: 'en_US' },
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
