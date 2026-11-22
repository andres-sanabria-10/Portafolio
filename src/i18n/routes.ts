import type { Lang } from './config';

/**
 * Mapa central de rutas. Cada clave es una página lógica y el valor es su
 * primer segmento de URL en cada idioma (sin barras). Para añadir una página
 * nueva (por ejemplo `playground`), se agrega aquí y se crean sus archivos en
 * `src/pages/` y `src/pages/en/`.
 */
export const routes = {
  home: { es: '', en: '' },
  projects: { es: 'proyectos', en: 'projects' },
  learn: { es: 'aprende', en: 'learn' },
  blog: { es: 'blog', en: 'blog' },
  about: { es: 'sobre-mi', en: 'about' },
  contact: { es: 'contacto', en: 'contact' },
  playground: { es: 'playground', en: 'playground' },
} as const satisfies Record<string, Record<Lang, string>>;

export type RouteKey = keyof typeof routes;

/** Orden de los enlaces en la navegación principal. */
export const navRoutes = [
  'home',
  'projects',
  'learn',
  'blog',
  'about',
  'contact',
] as const satisfies readonly RouteKey[];

/** Ruta de listado que corresponde a cada colección de contenido. */
export const collectionRoutes = {
  proyectos: 'projects',
  aprende: 'learn',
  blog: 'blog',
} as const satisfies Record<string, RouteKey>;

export type ContentCollection = keyof typeof collectionRoutes;
