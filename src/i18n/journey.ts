import type { Lang } from './config';

/**
 * "El viaje de un dato": una guía sintética recorre el pipeline, del JSON de la
 * API a la métrica del tablero. Lo usan DataJourney.vue (nota interactiva) y
 * DataJourneyPoster.astro (imagen para redes).
 *
 * Datos 100 % sintéticos y nombres genéricos (Transportadora C, fact_envios).
 * La versión en inglés llega en la fase 5; mientras tanto se usa la española.
 */
export interface JourneyField {
  key: string;
  value: string;
  /** Valor anterior cuando la etapa lo cambia (se muestra tachado). */
  before?: string;
}

export interface JourneyStep {
  id: string;
  label: string;
  where: string;
  title: string;
  body: string;
  changes: string[];
  fields: JourneyField[];
}

export interface JourneyContent {
  steps: JourneyStep[];
  labels: {
    rail: string;
    prev: string;
    next: string;
    changes: string;
    record: string;
    stepOf: string;
  };
}

const es: JourneyContent = {
  labels: {
    rail: 'Etapas del pipeline',
    prev: 'Etapa anterior',
    next: 'Etapa siguiente',
    changes: 'Qué cambió',
    record: 'El registro en esta etapa',
    stepOf: 'Etapa {n} de {total}',
  },
  steps: [
    {
      id: 'api',
      label: 'API',
      where: 'Respuesta de la transportadora',
      title: 'Así llega: sucio y a su manera',
      body: 'Cada transportadora responde con su propio formato. Esta guía trae espacios y un punto en la llave, el estado con su vocabulario, la ciudad con abreviaturas, el peso en cero y una fecha en formato local.',
      changes: ['Nada todavía: es el dato tal como lo entrega la API.'],
      fields: [
        { key: 'numero', value: '" GS482193. "' },
        { key: 'estado', value: '"ENTREGADA"' },
        { key: 'ciudad_destino', value: '"Bogotá D.C."' },
        { key: 'kilos', value: '"0"' },
        { key: 'fecha', value: '"04/05/2026 10:05:21 a.m."' },
        { key: 'nit_destino', value: '"9009614888"' },
      ],
    },
    {
      id: 'raw',
      label: 'Raw',
      where: 'Tabla raw en SQL Server',
      title: 'Se guarda tal cual, con su fecha de carga',
      body: 'La ingesta corre cada 4 horas y trae solo lo nuevo. Guarda los campos que el negocio usa sin limpiarlos: si mañana cambia una regla, se recalcula desde aquí sin volver a llamar a la API.',
      changes: [
        'Se agregan transportadora, id de carga y fecha de carga.',
        'Los valores siguen sin tocar.',
      ],
      fields: [
        { key: 'id_carga', value: '18204' },
        { key: 'fecha_carga', value: '2026-05-04 12:00:03' },
        { key: 'transportadora', value: 'Transportadora C' },
        { key: 'numero', value: "' GS482193. '" },
        { key: 'estado', value: "'ENTREGADA'" },
        { key: 'ciudad_destino', value: "'Bogotá D.C.'" },
        { key: 'kilos', value: "'0'" },
      ],
    },
    {
      id: 'staging',
      label: 'Staging',
      where: 'Vista de staging',
      title: 'Se limpia una sola vez, con reglas',
      body: 'Una vista aplica todas las reglas de limpieza en un solo lugar. Así, dos tableros nunca limpian distinto el mismo dato.',
      changes: [
        'Llave sin espacios ni puntuación.',
        'Estado traducido con la tabla de mapeo.',
        'Ciudad normalizada (mayúsculas, sin tildes).',
        'Peso en cero pasa a NULL: no se conoce.',
        'Fecha con tipo y NIT sin dígito de verificación.',
      ],
      fields: [
        { key: 'guia', value: "'GS482193'", before: "' GS482193. '" },
        { key: 'estado_comun', value: "'entregado'", before: "'ENTREGADA'" },
        { key: 'ciudad_destino', value: "'BOGOTA'", before: "'Bogotá D.C.'" },
        { key: 'peso_kg', value: 'NULL', before: "'0'" },
        { key: 'fecha_evento', value: '2026-05-04 10:05:21', before: "'04/05/2026 10:05:21 a.m.'" },
        { key: 'nit_destino', value: '900961488', before: "'9009614888'" },
      ],
    },
    {
      id: 'modelo',
      label: 'Modelo',
      where: 'fact_envios (una fila por guía)',
      title: 'Una fila por guía, con su historia',
      body: 'Los eventos de la guía (recogida, tránsito y entrega) se pivotean a una sola fila con la fecha de cada etapa. Con ese grano, ninguna guía se cuenta dos veces.',
      changes: [
        'Tres eventos se vuelven una fila.',
        'Se calcula la fecha prometida y si llegó a tiempo.',
      ],
      fields: [
        { key: 'guia', value: "'GS482193'" },
        { key: 'ruta', value: "'BUCARAMANGA → BOGOTA'" },
        { key: 'fecha_recogida', value: '2026-05-02 16:40' },
        { key: 'fecha_transito', value: '2026-05-03 21:58' },
        { key: 'fecha_entrega', value: '2026-05-04 10:05' },
        { key: 'fecha_prometida', value: '2026-05-04 23:59' },
        { key: 'a_tiempo', value: 'true' },
      ],
    },
    {
      id: 'metrica',
      label: 'Métrica',
      where: 'Consulta y tablero',
      title: 'Y responde una pregunta de negocio',
      body: 'Junto con miles de guías, esta fila responde: para ir de Bucaramanga a Bogotá, ¿qué transportadora llega más rápido? Solo se comparan las que atienden la misma ruta.',
      changes: ['Agregado por ruta y transportadora, con RANK() dentro de cada ruta.'],
      fields: [
        { key: 'ruta', value: "'BUCARAMANGA → BOGOTA'" },
        { key: 'transportadora', value: "'Transportadora C'" },
        { key: 'entregas', value: '412' },
        { key: 'dias_promedio', value: '1.6' },
        { key: 'puesto_en_ruta', value: '1 de 4' },
      ],
    },
  ],
};

const content: Partial<Record<Lang, JourneyContent>> = { es };

export function getJourneyContent(lang: Lang): JourneyContent {
  return content[lang] ?? es;
}
