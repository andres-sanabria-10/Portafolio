import type { Lang } from './config';

/**
 * La misma tubería en dos entornos: on-premise (como corre hoy) y AWS (cómo
 * se armaría en la nube). La usa CloudPipeline.vue en el blog.
 * La versión en inglés llega en la fase 5; mientras tanto se usa la española.
 */
export type Environment = 'onprem' | 'aws';

export interface CloudPiece {
  tech: string;
  detail: string;
}

export interface CloudStage {
  id: string;
  name: string;
  onprem: CloudPiece;
  aws: CloudPiece;
}

export interface CloudContent {
  stages: CloudStage[];
  labels: {
    group: string;
    onprem: string;
    aws: string;
    showing: string;
    tableCaption: string;
    stage: string;
    diagram: string;
  };
}

const es: CloudContent = {
  labels: {
    group: 'Entorno de la tubería',
    onprem: 'On-premise',
    aws: 'AWS',
    showing: 'Mostrando la tubería en {env}.',
    tableCaption: 'Las mismas etapas del pipeline, on-premise y en AWS',
    stage: 'Etapa',
    diagram:
      'Tubería animada con cinco etapas: ingesta, raw, staging, modelo y consumo. El dato fluye por ellas; el selector cambia las piezas de cada etapa entre on-premise y AWS.',
  },
  stages: [
    {
      id: 'ingesta',
      name: 'Ingesta',
      onprem: { tech: 'Python', detail: 'Programador de tareas' },
      aws: { tech: 'Lambda', detail: '+ EventBridge' },
    },
    {
      id: 'raw',
      name: 'Raw',
      onprem: { tech: 'SQL Server', detail: 'tabla raw' },
      aws: { tech: 'Amazon S3', detail: 'Parquet por fecha' },
    },
    {
      id: 'staging',
      name: 'Staging',
      onprem: { tech: 'Vistas SQL', detail: 'reglas de limpieza' },
      aws: { tech: 'AWS Glue', detail: 'catálogo + jobs' },
    },
    {
      id: 'modelo',
      name: 'Modelo',
      onprem: { tech: 'Vistas SQL', detail: 'una fila por guía' },
      aws: { tech: 'Athena', detail: 'o Redshift si crece' },
    },
    {
      id: 'consumo',
      name: 'Consumo',
      onprem: { tech: 'Power BI', detail: 'tableros' },
      aws: { tech: 'QuickSight', detail: 'o Power BI' },
    },
  ],
};

const content: Partial<Record<Lang, CloudContent>> = { es };

export function getCloudContent(lang: Lang): CloudContent {
  return content[lang] ?? es;
}
