# andres-sanabria-10.github.io

Portafolio y blog técnico de Andrés Felipe Sanabria, orientado a ingeniería de datos: casos de estudio, notas de aprendizaje y artículos. Sitio estático bilingüe (español en `/`, inglés en `/en/`) publicado en GitHub Pages: <https://andres-sanabria-10.github.io>

> Estado: fase 1 (base). Están listos la estructura, la navegación, el i18n, los temas y el despliegue. El contenido y los componentes interactivos llegan en las fases siguientes.

## Stack

- [Astro](https://astro.build) con TypeScript estricto y Content Collections (esquemas Zod)
- Vue 3 para los componentes interactivos (islas)
- Tailwind CSS 4
- MDX, sitemap y Pagefind (índice de búsqueda)
- Vitest y `astro check`
- GitHub Actions: despliegue a Pages y Lighthouse CI en cada pull request

## Cómo correrlo

Requiere Node.js 22.12 o superior.

```bash
npm install
npm run dev        # http://localhost:4321
```

| Comando           | Qué hace                                             |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con recarga                   |
| `npm run check`   | Comprueba tipos en archivos `.astro`, `.ts` y `.vue` |
| `npm test`        | Pruebas unitarias con Vitest                         |
| `npm run build`   | Genera el sitio en `dist/`                           |
| `npm run pagefind`| Crea el índice de búsqueda sobre `dist/`             |
| `npm run preview` | Sirve `dist/` para revisarlo antes de publicar       |

## Estructura

```text
src/
  components/        Componentes Astro (cabecera, pie, avisos, listados)
  components/pages/  Cuerpo de cada página, compartido por los dos idiomas
  components/vue/    Islas interactivas en Vue
  content/           proyectos, aprende y blog, cada uno con es/ y en/
  content.config.ts  Esquemas Zod de las colecciones
  i18n/              Idiomas, textos de interfaz, mapa de rutas y helpers
  layouts/           BaseLayout (metadatos, hreflang, tema)
  pages/             Rutas en español; pages/en/ para inglés
  styles/            Tokens de diseño y estilos globales
scripts/             Scripts de datos en Python
public/              Archivos estáticos
```

### Contenido bilingüe

Cada contenido vive en `src/content/<colección>/<idioma>/<slug>.mdx`. Dos archivos con el mismo nombre en `es/` y `en/` son traducciones entre sí. Si falta una, la página se genera igual con el texto del otro idioma y un aviso de traducción pendiente.

Las rutas de cada idioma se definen en un solo lugar: `src/i18n/routes.ts`.

## Despliegue

El workflow `.github/workflows/deploy.yml` se ejecuta en cada push a `main`: instala dependencias, corre `astro check` y las pruebas, compila, genera el índice de Pagefind y publica con `actions/deploy-pages`.

Para activarlo por primera vez:

1. En GitHub, abre el repositorio y entra a **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Haz push a `main` (o lanza el workflow *Deploy* a mano desde la pestaña **Actions**).

El repositorio debe llamarse `andres-sanabria-10.github.io` para que el sitio quede en la raíz del dominio.

En los pull requests, `.github/workflows/ci.yml` repite las comprobaciones y ejecuta Lighthouse CI con un mínimo de 95 en rendimiento, accesibilidad, buenas prácticas y SEO (`lighthouserc.json`).
