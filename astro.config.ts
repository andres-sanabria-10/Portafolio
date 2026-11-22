import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defaultLang, locales } from './src/i18n/config';

// Sitio de usuario de GitHub Pages: se sirve desde la raíz, sin `base`.
export default defineConfig({
  site: 'https://andres-sanabria-10.github.io',
  trailingSlash: 'always',
  i18n: {
    locales: [...locales],
    defaultLocale: defaultLang,
    routing: { prefixDefaultLocale: false },
  },
  integrations: [vue(), mdx(), sitemap()],
  markdown: {
    // Dos temas de Shiki como variables CSS; `global.css` elige según data-theme.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
