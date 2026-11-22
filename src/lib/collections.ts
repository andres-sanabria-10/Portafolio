import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/config';
import { localizeEntries, type LocalizedEntry } from '../i18n/content';
import type { ContentCollection } from '../i18n/routes';

export type LocalizedItem<C extends ContentCollection = ContentCollection> = LocalizedEntry<
  CollectionEntry<C>
>;

/**
 * Entradas de una colección para un idioma, de la más reciente a la más
 * antigua. Si a una entrada le falta la traducción, se incluye la versión del
 * otro idioma con `isFallback: true`. Los borradores solo aparecen en desarrollo.
 */
export async function getLocalizedCollection<C extends ContentCollection>(
  collection: C,
  lang: Lang,
): Promise<LocalizedItem<C>[]> {
  const entries: CollectionEntry<C>[] = await getCollection(collection);
  const visible = entries.filter((entry) => import.meta.env.DEV || !entry.data.draft);
  return localizeEntries(visible, lang);
}

/** `getStaticPaths` compartido por las páginas de detalle de las tres colecciones. */
export async function getEntryStaticPaths<C extends ContentCollection>(collection: C, lang: Lang) {
  const items = await getLocalizedCollection(collection, lang);
  return items.map((item) => ({ params: { slug: item.slug }, props: { item } }));
}
