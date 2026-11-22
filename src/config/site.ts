/** Datos del sitio que no dependen del idioma. */
export const site = {
  author: 'Andrés Felipe Sanabria',
  githubUser: 'andres-sanabria-10',
  github: 'https://github.com/andres-sanabria-10',
  repo: 'https://github.com/andres-sanabria-10/Portafolio',
  linkedin: 'https://www.linkedin.com/in/andres-felipe-sanabria',
  /** Marcador: el PDF real se agrega en `public/cv.pdf` (pendiente de la fase 6). */
  cv: '/cv.pdf',
  /** TODO: correo de contacto. Mientras sea `null`, la página de contacto no lo muestra. */
  email: null as string | null,
  certifications: ['IBM Web Development with Python', 'IBM Agile Explorer (2025)'],
} as const;
