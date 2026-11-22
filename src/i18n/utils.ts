import { defaultLang, isLang, localeMeta, locales, type Lang } from './config';
import { routes, type RouteKey } from './routes';
import { ui, type UiKey } from './ui';

type PathInput = URL | string;

function toSegments(input: PathInput): string[] {
  const pathname = typeof input === 'string' ? input : input.pathname;
  return pathname.split('/').filter(Boolean);
}

/** Idioma de una URL: el prefijo (`/en/...`) o el idioma por defecto. */
export function getLangFromUrl(url: PathInput): Lang {
  const [first] = toSegments(url);
  return isLang(first) ? first : defaultLang;
}

/**
 * Devuelve la función `t` para un idioma. Si una clave no existe en ese
 * idioma, cae al idioma por defecto. Admite variables: `t('k', { n: 3 })`
 * reemplaza `{n}` en el texto.
 */
export function useTranslations(lang: Lang) {
  return function t(key: UiKey, vars?: Record<string, string | number>): string {
    const template: string = ui[lang][key] ?? ui[defaultLang][key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/**
 * Construye la ruta absoluta de una página en un idioma, siempre con barra
 * final (el sitio usa `trailingSlash: 'always'`).
 *
 * @example getRoutePath('projects', 'en') // '/en/projects/'
 * @example getRoutePath('learn', 'es', 'colas') // '/aprende/colas/'
 */
export function getRoutePath(route: RouteKey, lang: Lang, rest = ''): string {
  const parts = [
    lang === defaultLang ? '' : lang,
    routes[route][lang],
    ...rest.split('/'),
  ].filter(Boolean);
  return parts.length > 0 ? `/${parts.join('/')}/` : '/';
}

export interface RouteMatch {
  lang: Lang;
  /** Página lógica, o `null` si la ruta no está en el mapa. */
  route: RouteKey | null;
  /** Lo que queda después del segmento de la página (por ejemplo, un slug). */
  rest: string;
}

/** Identifica a qué página lógica pertenece una ruta. */
export function matchRoute(url: PathInput): RouteMatch {
  const lang = getLangFromUrl(url);
  const segments = toSegments(url);
  if (segments[0] === lang) segments.shift();

  const [first, ...others] = segments;
  if (first === undefined) return { lang, route: 'home', rest: '' };

  const route = (Object.keys(routes) as RouteKey[]).find(
    (key) => key !== 'home' && routes[key][lang] === first,
  );
  return { lang, route: route ?? null, rest: route ? others.join('/') : '' };
}

/**
 * Ruta equivalente en otro idioma. Si la ruta no está en el mapa, devuelve
 * el inicio del idioma de destino en lugar de un enlace roto.
 *
 * @example getAlternatePath('/proyectos/trazabilidad/', 'en') // '/en/projects/trazabilidad/'
 */
export function getAlternatePath(url: PathInput, targetLang: Lang): string {
  const { route, rest } = matchRoute(url);
  return getRoutePath(route ?? 'home', targetLang, rest);
}

/** Indica si la URL actual pertenece a una página (o a una de sus subpáginas). */
export function isCurrentRoute(url: PathInput, route: RouteKey): boolean {
  return matchRoute(url).route === route;
}

/** Los demás idiomas disponibles, para el selector. */
export function getOtherLangs(lang: Lang): Lang[] {
  return locales.filter((locale) => locale !== lang);
}

/** Fecha legible en el idioma indicado, calculada en UTC para que no dependa de la máquina que compila. */
export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeMeta[lang].htmlLang, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
