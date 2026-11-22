import type { Lang } from './config';

/**
 * Stack del inicio, agrupado por la etapa del pipeline donde se usa cada
 * herramienta. Los nombres de las tecnologías no se traducen; las categorías y
 * las notas sí. Sin niveles ni porcentajes: la nota dice para qué la uso.
 */
interface StackItem {
  name: string;
  note?: Record<Lang, string>;
  /** La estoy aprendiendo; todavía no la uso en producción. */
  learning?: boolean;
}

interface StackGroup {
  id: string;
  title: Record<Lang, string>;
  items: StackItem[];
}

export const stackGroups: StackGroup[] = [
  {
    id: 'ingesta',
    title: { es: 'Ingesta', en: 'Ingestion' },
    items: [
      {
        name: 'APIs REST y SOAP',
        note: { es: 'integración con transportadoras', en: 'carrier integrations' },
      },
      { name: 'Python', note: { es: 'extracción y carga', en: 'extract and load' } },
      {
        name: 'Google Sheets y Drive API',
        note: { es: 'con cuenta de servicio', en: 'with a service account' },
      },
    ],
  },
  {
    id: 'transformacion',
    title: { es: 'Transformación', en: 'Transformation' },
    items: [
      { name: 'pandas', note: { es: 'limpieza y normalización', en: 'cleaning and normalization' } },
      {
        name: 'T-SQL',
        note: {
          es: 'CTEs, window functions, procedimientos',
          en: 'CTEs, window functions, stored procedures',
        },
      },
      { name: 'Power Query (M)' },
    ],
  },
  {
    id: 'almacenamiento',
    title: { es: 'Almacenamiento', en: 'Storage' },
    items: [
      {
        name: 'SQL Server',
        note: { es: 'staging, hechos y dimensiones', en: 'staging, facts and dimensions' },
      },
      { name: 'Parquet y DuckDB', note: { es: 'análisis local', en: 'local analysis' } },
      { name: 'Amazon S3', learning: true },
    ],
  },
  {
    id: 'orquestacion',
    title: { es: 'Orquestación y nube', en: 'Orchestration and cloud' },
    items: [
      { name: 'Google Cloud Run', note: { es: 'jobs programados', en: 'scheduled jobs' } },
      { name: 'Render', note: { es: 'backends de aplicaciones', en: 'application backends' } },
      { name: 'GitHub Actions', note: { es: 'CI/CD de este sitio', en: 'CI/CD for this site' } },
      { name: 'AWS Glue y Athena', learning: true },
    ],
  },
  {
    id: 'visualizacion',
    title: { es: 'Visualización', en: 'Visualization' },
    items: [
      { name: 'Power BI', note: { es: 'modelos y tableros', en: 'models and dashboards' } },
      {
        name: 'DAX',
        note: { es: 'medidas validadas contra SQL', en: 'measures validated against SQL' },
      },
    ],
  },
  {
    id: 'desarrollo',
    title: { es: 'Desarrollo', en: 'Development' },
    items: [
      { name: 'FastAPI', note: { es: 'APIs de aplicaciones internas', en: 'internal app APIs' } },
      { name: 'Vue y React', note: { es: 'frontends', en: 'frontends' } },
      {
        name: 'Google Apps Script',
        note: { es: 'automatizaciones en hojas de cálculo', en: 'spreadsheet automations' },
      },
      { name: 'Git y GitHub' },
    ],
  },
];
