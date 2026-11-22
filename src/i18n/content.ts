import { defaultLang, isLang, type Lang } from './config';

/**
 * Helpers puros para el contenido bilingüe. Cada colección guarda sus
 * archivos en `<colección>/<idioma>/<slug>.mdx`, así que el `id` que genera
 * el loader es `<idioma>/<slug>`. Dos archivos con el mismo slug en `es/` y
 * `en/` son traducciones entre sí.
 */

interface EntryLike {
  id: string;
  data: { date: Date };
}

export interface LocalizedEntry<T> {
  entry: T;
  slug: string;
  /** Idioma en el que está escrito el contenido que se va a mostrar. */
  contentLang: Lang;
  /** `true` si no hay traducción y se muestra la versión en otro idioma. */
  isFallback: boolean;
}

export function parseEntryId(id: string): { lang: Lang; slug: string } {
  const [first, ...rest] = id.split('/');
  if (isLang(first) && rest.length > 0) {
    return { lang: first, slug: rest.join('/') };
  }
  return { lang: defaultLang, slug: id };
}

/**
 * Arma la lista de entradas para un idioma: una por slug, usando la versión
 * de ese idioma si existe y, si no, la del idioma por defecto (o la que haya)
 * marcada con `isFallback` para mostrar el aviso de traducción pendiente.
 * Devuelve las más recientes primero.
 */
export function localizeEntries<T extends EntryLike>(
  entries: readonly T[],
  lang: Lang,
): LocalizedEntry<T>[] {
  const bySlug = new Map<string, Partial<Record<Lang, T>>>();
  for (const entry of entries) {
    const { lang: entryLang, slug } = parseEntryId(entry.id);
    const versions = bySlug.get(slug) ?? {};
    versions[entryLang] = entry;
    bySlug.set(slug, versions);
  }

  const result: LocalizedEntry<T>[] = [];
  for (const [slug, versions] of bySlug) {
    const preferred: Lang[] = [lang, defaultLang, ...(Object.keys(versions) as Lang[])];
    const contentLang = preferred.find((candidate) => versions[candidate] !== undefined);
    const entry = contentLang && versions[contentLang];
    if (!contentLang || !entry) continue;
    result.push({ entry, slug, contentLang, isFallback: contentLang !== lang });
  }

  return result.sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}
