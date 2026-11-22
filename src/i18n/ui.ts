import type { Lang } from './config';

/**
 * Textos de la interfaz. El español es la fuente: sus claves definen el tipo
 * `UiKey`, y el diccionario en inglés está tipado para que falle `astro check`
 * si falta o sobra alguna clave.
 */
const es = {
  'site.name': 'Andrés Sanabria',
  'site.tagline': 'Ingeniero de Datos Jr',
  'site.description':
    'Portafolio y blog técnico de Andrés Felipe Sanabria: pipelines de datos, ETL con Python, SQL Server y calidad del dato.',

  'a11y.skip': 'Saltar al contenido',
  'a11y.externalLink': '(se abre en una pestaña nueva)',

  'nav.label': 'Navegación principal',
  'nav.home': 'Inicio',
  'nav.projects': 'Proyectos',
  'nav.learn': 'Aprende',
  'nav.blog': 'Blog',
  'nav.about': 'Sobre mí',
  'nav.contact': 'Contacto',
  'nav.menu': 'Menú',

  'theme.toLight': 'Cambiar a modo claro',
  'theme.toDark': 'Cambiar a modo oscuro',

  'lang.switchTo': 'Ver esta página en {language}',
  'lang.es': 'español',
  'lang.en': 'inglés',

  'footer.label': 'Pie de página',
  'footer.nav': 'Enlaces del sitio',
  'footer.social': 'Perfiles',
  'footer.builtWith': 'Hecho con Astro, Vue y Tailwind CSS. Desplegado con GitHub Actions.',
  'footer.source': 'Código fuente',

  'home.title': 'Andrés Sanabria | Ingeniero de Datos Jr',
  'home.hero.title':
    'Construyo pipelines de datos que convierten información dispersa en decisiones confiables.',
  'home.hero.from': 'Analista BI',
  'home.hero.to': 'Ingeniero de Datos Jr',
  'home.hero.lead':
    'Hago ETL desde bases de datos y APIs con Python y SQL Server, y valido cada indicador contra su fuente.',
  'home.cta.projects': 'Ver proyectos',
  'home.cta.cv': 'Descargar CV',
  'home.cta.linkedin': 'LinkedIn',
  'home.profile.caption': 'Perfil en formato de tabla de esquema',
  'home.profile.role': 'Analista BI',
  'home.profile.location': 'Bucaramanga, Colombia',
  'home.profile.mode': 'Remoto o híbrido',
  'home.profile.focus': 'ETL, SQL y calidad del dato',
  'home.profile.learning': 'AWS Data Engineering',
  'home.featured.title': 'Proyectos destacados',
  'home.featured.all': 'Todos los proyectos',
  'home.latest.title': 'Lo último que aprendí',
  'home.latest.all': 'Todas las notas',

  'projects.title': 'Proyectos',
  'projects.description':
    'Casos de estudio de ingeniería de datos: el problema, la arquitectura, las decisiones técnicas y los resultados.',
  'projects.empty.title': 'Los casos de estudio están en redacción',
  'projects.empty.body':
    'Aquí voy a publicar cada proyecto con su arquitectura, el código clave y las decisiones que tomé. Mientras tanto, puedes ver mi código en GitHub.',

  'learn.title': 'Aprende',
  'learn.description':
    'Mi bitácora de conceptos de ingeniería de datos: notas cortas con una analogía, un diagrama y un ejemplo en código o SQL.',
  'learn.empty.title': 'Las primeras notas están en camino',
  'learn.empty.body':
    'Voy a empezar por colas de mensajes, ETL frente a ELT y window functions en SQL.',

  'blog.title': 'Blog',
  'blog.description':
    'Artículos más largos sobre mi paso de la inteligencia de negocios a la ingeniería de datos.',
  'blog.empty.title': 'El primer artículo está en redacción',
  'blog.empty.body':
    'Trata sobre lo que ya hacía como analista BI sin saber que era ingeniería de datos.',

  'about.title': 'Sobre mí',
  'about.description':
    'De las telecomunicaciones al desarrollo web, de ahí a la inteligencia de negocios y ahora a la ingeniería de datos.',
  'about.intro':
    'Soy Andrés Felipe Sanabria. Vivo en Bucaramanga, Colombia, y busco mi primer rol como Ingeniero de Datos Jr. Estoy abierto a trabajo remoto o híbrido y a trasladarme dentro de Colombia.',
  'about.path.title': 'Mi recorrido',
  'about.path.telecom.title': 'Telecomunicaciones',
  'about.path.telecom.body': 'Tecnólogo en telecomunicaciones del SENA.',
  'about.path.systems.title': 'Ingeniería de sistemas y desarrollo web',
  'about.path.systems.body':
    'Ingeniería de sistemas en la UPTC: materias aprobadas y trabajo de grado en curso.',
  'about.path.bi.title': 'Inteligencia de negocios',
  'about.path.bi.body':
    'Desde febrero de 2026 soy Analista BI en Ramedicas, un operador logístico farmacéutico en Colombia.',
  'about.path.data.title': 'Ingeniería de datos',
  'about.path.data.body':
    'En la práctica mi trabajo ya es ingeniería de datos: ETL desde bases de datos y APIs, Python con pandas, SQL Server, calidad del dato y aplicaciones internas.',
  'about.now.title': 'Qué estoy aprendiendo',
  'about.now.body': 'AWS Data Engineering.',
  'about.certs.title': 'Certificaciones',
  'about.wip': 'La versión completa de esta historia, con la línea de tiempo, está en preparación.',
  'about.photo.alt': 'Retrato de Andrés Felipe Sanabria',

  'contact.title': 'Contacto',
  'contact.description':
    'Escríbeme por LinkedIn o revisa mi código en GitHub. Respondo mensajes sobre vacantes de ingeniería de datos.',
  'contact.linkedin.body': 'El canal más rápido para hablar de una vacante.',
  'contact.github.body': 'El código de este sitio y de mis proyectos.',

  'notFound.title': 'Página no encontrada',
  'notFound.code': 'Error 404',
  'notFound.body':
    'Esta ruta no devolvió ninguna fila. Puede que el enlace esté roto o que la página se haya movido.',
  'notFound.home': 'Volver al inicio',

  'content.translationMissing.title': 'Traducción pendiente',
  'content.translationMissing.body':
    'Este contenido todavía no está disponible en español. Estás viendo la versión original en {language}.',
  'content.published': 'Publicado',
  'content.stack': 'Tecnologías',
  'content.tags': 'Temas',
  'content.role': 'Rol',
  'content.status': 'Estado',
  'content.level': 'Nivel',
  'content.repo': 'Repositorio',
  'content.demo': 'Demo',
  'content.draft': 'Borrador',
  'content.back': 'Volver a {section}',
} as const;

export type UiKey = keyof typeof es;

const en: Record<UiKey, string> = {
  'site.name': 'Andrés Sanabria',
  'site.tagline': 'Junior Data Engineer',
  'site.description':
    'Portfolio and technical blog of Andrés Felipe Sanabria: data pipelines, ETL with Python, SQL Server and data quality.',

  'a11y.skip': 'Skip to content',
  'a11y.externalLink': '(opens in a new tab)',

  'nav.label': 'Main navigation',
  'nav.home': 'Home',
  'nav.projects': 'Projects',
  'nav.learn': 'Learn',
  'nav.blog': 'Blog',
  'nav.about': 'About',
  'nav.contact': 'Contact',
  'nav.menu': 'Menu',

  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',

  'lang.switchTo': 'View this page in {language}',
  'lang.es': 'Spanish',
  'lang.en': 'English',

  'footer.label': 'Footer',
  'footer.nav': 'Site links',
  'footer.social': 'Profiles',
  'footer.builtWith': 'Built with Astro, Vue and Tailwind CSS. Deployed with GitHub Actions.',
  'footer.source': 'Source code',

  'home.title': 'Andrés Sanabria | Junior Data Engineer',
  'home.hero.title': 'I build data pipelines that turn scattered information into decisions you can trust.',
  'home.hero.from': 'BI Analyst',
  'home.hero.to': 'Junior Data Engineer',
  'home.hero.lead':
    'I build ETL from databases and APIs with Python and SQL Server, and I validate every metric against its source.',
  'home.cta.projects': 'View projects',
  'home.cta.cv': 'Download CV',
  'home.cta.linkedin': 'LinkedIn',
  'home.profile.caption': 'Profile shown as a schema table',
  'home.profile.role': 'BI Analyst',
  'home.profile.location': 'Bucaramanga, Colombia',
  'home.profile.mode': 'Remote or hybrid',
  'home.profile.focus': 'ETL, SQL and data quality',
  'home.profile.learning': 'AWS Data Engineering',
  'home.featured.title': 'Featured projects',
  'home.featured.all': 'All projects',
  'home.latest.title': 'What I learned lately',
  'home.latest.all': 'All notes',

  'projects.title': 'Projects',
  'projects.description':
    'Data engineering case studies: the problem, the architecture, the technical decisions and the results.',
  'projects.empty.title': 'The case studies are being written',
  'projects.empty.body':
    'Each project will be published here with its architecture, the key code and the decisions I made. In the meantime, you can browse my code on GitHub.',

  'learn.title': 'Learn',
  'learn.description':
    'My logbook of data engineering concepts: short notes with an analogy, a diagram and a code or SQL example.',
  'learn.empty.title': 'The first notes are on their way',
  'learn.empty.body':
    'I will start with message queues, ETL versus ELT, and SQL window functions.',

  'blog.title': 'Blog',
  'blog.description':
    'Longer articles about my move from business intelligence to data engineering.',
  'blog.empty.title': 'The first article is being written',
  'blog.empty.body':
    'It covers what I was already doing as a BI analyst without knowing it was data engineering.',

  'about.title': 'About',
  'about.description':
    'From telecommunications to web development, then to business intelligence and now to data engineering.',
  'about.intro':
    'I am Andrés Felipe Sanabria. I live in Bucaramanga, Colombia, and I am looking for my first role as a Junior Data Engineer. I am open to remote or hybrid work and to relocating within Colombia.',
  'about.path.title': 'My path',
  'about.path.telecom.title': 'Telecommunications',
  'about.path.telecom.body': 'Telecommunications technologist degree from SENA.',
  'about.path.systems.title': 'Systems engineering and web development',
  'about.path.systems.body':
    'Systems engineering at UPTC: coursework completed and degree project in progress.',
  'about.path.bi.title': 'Business intelligence',
  'about.path.bi.body':
    'Since February 2026 I have been a BI Analyst at Ramedicas, a pharmaceutical logistics operator in Colombia.',
  'about.path.data.title': 'Data engineering',
  'about.path.data.body':
    'In practice my work is already data engineering: ETL from databases and APIs, Python with pandas, SQL Server, data quality and internal applications.',
  'about.now.title': 'What I am learning',
  'about.now.body': 'AWS Data Engineering.',
  'about.certs.title': 'Certifications',
  'about.wip': 'The full version of this story, with the timeline, is in the works.',
  'about.photo.alt': 'Portrait of Andrés Felipe Sanabria',

  'contact.title': 'Contact',
  'contact.description':
    'Message me on LinkedIn or browse my code on GitHub. I reply to messages about data engineering openings.',
  'contact.linkedin.body': 'The fastest way to talk about an opening.',
  'contact.github.body': 'The code for this site and for my projects.',

  'notFound.title': 'Page not found',
  'notFound.code': 'Error 404',
  'notFound.body':
    'This route returned zero rows. The link may be broken or the page may have moved.',
  'notFound.home': 'Back to home',

  'content.translationMissing.title': 'Translation pending',
  'content.translationMissing.body':
    'This content is not available in English yet. You are reading the original version in {language}.',
  'content.published': 'Published',
  'content.stack': 'Technologies',
  'content.tags': 'Topics',
  'content.role': 'Role',
  'content.status': 'Status',
  'content.level': 'Level',
  'content.repo': 'Repository',
  'content.demo': 'Demo',
  'content.draft': 'Draft',
  'content.back': 'Back to {section}',
};

export const ui: Record<Lang, Record<UiKey, string>> = { es, en };

/**
 * Los valores de `status` y `level` del frontmatter se escriben en español en
 * ambos idiomas (así lo define el esquema). Estos mapas los traducen al mostrarlos.
 */
export const statusLabels = {
  es: {
    'en producción': 'En producción',
    'en desarrollo': 'En desarrollo',
    'proyecto personal': 'Proyecto personal',
  },
  en: {
    'en producción': 'In production',
    'en desarrollo': 'In development',
    'proyecto personal': 'Personal project',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export const levelLabels = {
  es: { básico: 'Básico', intermedio: 'Intermedio' },
  en: { básico: 'Basic', intermedio: 'Intermediate' },
} as const satisfies Record<Lang, Record<string, string>>;
