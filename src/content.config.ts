import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Cada colección vive en `src/content/<colección>/<idioma>/<slug>.{md,mdx}`.
 * El `id` resultante es `<idioma>/<slug>`; un mismo slug en `es/` y `en/`
 * identifica las dos versiones de un contenido (ver `src/i18n/content.ts`).
 */
const contentFiles = (collection: string) =>
  glob({ base: `./src/content/${collection}`, pattern: '{es,en}/**/*.{md,mdx}' });

/** Texto listo para publicar en LinkedIn (lo copia `CopyForLinkedIn.vue`). */
const linkedinPost = z.string().optional();

/** Los borradores se ven en `npm run dev` pero no se publican. */
const draft = z.boolean().default(false);

const proyectos = defineCollection({
  loader: contentFiles('proyectos'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      stack: z.array(z.string()).min(1),
      role: z.string(),
      status: z.enum(['en producción', 'en desarrollo', 'proyecto personal']),
      featured: z.boolean().default(false),
      repo: z.url().optional(),
      demo: z.url().optional(),
      /** Arquitectura resumida en pasos (la tarjeta destacada del inicio la dibuja). */
      flow: z.array(z.string()).min(2).optional(),
      cover: image().optional(),
      linkedin_post: linkedinPost,
      draft,
    }),
});

const aprende = defineCollection({
  loader: contentFiles('aprende'),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).min(1),
    level: z.enum(['básico', 'intermedio']),
    linkedin_post: linkedinPost,
    draft,
  }),
});

const blog = defineCollection({
  loader: contentFiles('blog'),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    linkedin_post: linkedinPost,
    draft,
  }),
});

export const collections = { proyectos, aprende, blog };
