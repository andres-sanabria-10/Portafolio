import { describe, expect, it } from 'vitest';
import { locales } from './config';
import { localizeEntries, parseEntryId } from './content';
import { navRoutes, routes, type RouteKey } from './routes';
import { ui } from './ui';
import {
  formatDate,
  getAlternatePath,
  getLangFromUrl,
  getOtherLangs,
  getRoutePath,
  isCurrentRoute,
  matchRoute,
  useTranslations,
} from './utils';

describe('getLangFromUrl', () => {
  it('usa español cuando la ruta no tiene prefijo', () => {
    expect(getLangFromUrl('/')).toBe('es');
    expect(getLangFromUrl('/proyectos/')).toBe('es');
  });

  it('detecta inglés por el prefijo /en/', () => {
    expect(getLangFromUrl('/en/')).toBe('en');
    expect(getLangFromUrl('/en/projects/trazabilidad/')).toBe('en');
  });

  it('acepta objetos URL', () => {
    expect(getLangFromUrl(new URL('https://example.com/en/learn/'))).toBe('en');
  });

  it('no confunde un segmento que empieza por "en" con el idioma', () => {
    expect(getLangFromUrl('/entradas/')).toBe('es');
  });
});

describe('useTranslations', () => {
  it('traduce una clave en cada idioma', () => {
    expect(useTranslations('es')('nav.projects')).toBe('Proyectos');
    expect(useTranslations('en')('nav.projects')).toBe('Projects');
  });

  it('interpola variables y deja intactas las que no recibe', () => {
    const t = useTranslations('en');
    expect(t('lang.switchTo', { language: t('lang.es') })).toBe('View this page in Spanish');
    expect(t('lang.switchTo', {})).toBe('View this page in {language}');
  });

  it('todos los idiomas tienen las mismas claves y ninguna está vacía', () => {
    const reference = Object.keys(ui.es).sort();
    for (const lang of locales) {
      expect(Object.keys(ui[lang]).sort()).toEqual(reference);
      for (const value of Object.values(ui[lang])) {
        expect(value.trim()).not.toBe('');
      }
    }
  });
});

describe('getRoutePath', () => {
  it('construye rutas con barra final y prefijo solo en inglés', () => {
    expect(getRoutePath('home', 'es')).toBe('/');
    expect(getRoutePath('home', 'en')).toBe('/en/');
    expect(getRoutePath('about', 'es')).toBe('/sobre-mi/');
    expect(getRoutePath('about', 'en')).toBe('/en/about/');
  });

  it('agrega el slug de una subpágina', () => {
    expect(getRoutePath('learn', 'es', 'colas-de-mensajes')).toBe('/aprende/colas-de-mensajes/');
    expect(getRoutePath('learn', 'en', '/colas-de-mensajes/')).toBe('/en/learn/colas-de-mensajes/');
  });
});

describe('matchRoute', () => {
  it('identifica la página lógica y el resto de la ruta', () => {
    expect(matchRoute('/')).toEqual({ lang: 'es', route: 'home', rest: '' });
    expect(matchRoute('/en/')).toEqual({ lang: 'en', route: 'home', rest: '' });
    expect(matchRoute('/en/projects/x/')).toEqual({ lang: 'en', route: 'projects', rest: 'x' });
  });

  it('devuelve null para rutas fuera del mapa', () => {
    expect(matchRoute('/no-existe/').route).toBeNull();
    // `projects` es el slug en inglés: bajo `/` (español) no es una página.
    expect(matchRoute('/projects/').route).toBeNull();
  });
});

describe('getAlternatePath', () => {
  it('es reversible para todas las páginas del mapa', () => {
    for (const route of Object.keys(routes) as RouteKey[]) {
      const es = getRoutePath(route, 'es');
      const en = getRoutePath(route, 'en');
      expect(getAlternatePath(es, 'en')).toBe(en);
      expect(getAlternatePath(en, 'es')).toBe(es);
    }
  });

  it('conserva el slug de las subpáginas', () => {
    expect(getAlternatePath('/proyectos/trazabilidad/', 'en')).toBe('/en/projects/trazabilidad/');
    expect(getAlternatePath('/en/blog/de-bi-a-datos/', 'es')).toBe('/blog/de-bi-a-datos/');
  });

  it('lleva al inicio del otro idioma si la ruta no está en el mapa', () => {
    expect(getAlternatePath('/404/', 'en')).toBe('/en/');
    expect(getAlternatePath('/en/whatever/', 'es')).toBe('/');
  });
});

describe('navegación', () => {
  it('marca como actual la página y sus subpáginas', () => {
    expect(isCurrentRoute('/aprende/colas/', 'learn')).toBe(true);
    expect(isCurrentRoute('/aprende/colas/', 'home')).toBe(false);
    expect(isCurrentRoute('/en/', 'home')).toBe(true);
  });

  it('cada enlace del menú tiene texto en todos los idiomas', () => {
    for (const route of navRoutes) {
      for (const lang of locales) {
        expect(ui[lang][`nav.${route}`]).toBeTruthy();
      }
    }
  });

  it('lista los demás idiomas para el selector', () => {
    expect(getOtherLangs('es')).toEqual(['en']);
    expect(getOtherLangs('en')).toEqual(['es']);
  });
});

describe('formatDate', () => {
  it('formatea en el idioma pedido sin depender de la zona horaria local', () => {
    const date = new Date('2026-02-01T00:00:00Z');
    expect(formatDate(date, 'es')).toBe('1 de febrero de 2026');
    expect(formatDate(date, 'en')).toBe('February 1, 2026');
  });
});

describe('contenido bilingüe', () => {
  const entry = (id: string, date: string) => ({ id, data: { date: new Date(date) } });

  it('separa idioma y slug a partir del id', () => {
    expect(parseEntryId('es/etl-vs-elt')).toEqual({ lang: 'es', slug: 'etl-vs-elt' });
    expect(parseEntryId('en/etl-vs-elt')).toEqual({ lang: 'en', slug: 'etl-vs-elt' });
    expect(parseEntryId('suelto')).toEqual({ lang: 'es', slug: 'suelto' });
  });

  it('usa la traducción cuando existe y marca el respaldo cuando falta', () => {
    const entries = [
      entry('es/colas', '2026-03-01'),
      entry('en/colas', '2026-03-01'),
      entry('es/solo-es', '2026-04-01'),
    ];

    const en = localizeEntries(entries, 'en');
    expect(en.map((item) => [item.slug, item.contentLang, item.isFallback])).toEqual([
      ['solo-es', 'es', true],
      ['colas', 'en', false],
    ]);

    const es = localizeEntries(entries, 'es');
    expect(es.every((item) => !item.isFallback)).toBe(true);
  });

  it('muestra en español un contenido que solo existe en inglés, con aviso', () => {
    const [item] = localizeEntries([entry('en/only-en', '2026-01-01')], 'es');
    expect(item).toMatchObject({ slug: 'only-en', contentLang: 'en', isFallback: true });
  });

  it('ordena de la más reciente a la más antigua', () => {
    const items = localizeEntries(
      [entry('es/a', '2026-01-01'), entry('es/b', '2026-06-01'), entry('es/c', '2026-03-01')],
      'es',
    );
    expect(items.map((item) => item.slug)).toEqual(['b', 'c', 'a']);
  });
});
