import type { Lang } from './config';

/**
 * Columnas de la vista `envios` del SqlPlayground. Versión corta del
 * diccionario de `scripts/README.md`; si cambian las columnas, se actualizan
 * los dos.
 */
export const envioColumns: { name: string; type: string; description: Record<Lang, string> }[] = [
  {
    name: 'guia',
    type: 'VARCHAR',
    description: {
      es: 'Llave del envío. Algunas filas traen espacios al inicio.',
      en: 'Shipment key. Some rows have leading spaces.',
    },
  },
  {
    name: 'transportadora',
    type: 'VARCHAR',
    description: { es: 'Transportadora A a G.', en: 'Carrier A to G.' },
  },
  {
    name: 'ciudad_origen',
    type: 'VARCHAR',
    description: { es: 'Centro de distribución.', en: 'Distribution center.' },
  },
  {
    name: 'ciudad_destino',
    type: 'VARCHAR',
    description: { es: 'Ciudad de entrega.', en: 'Delivery city.' },
  },
  {
    name: 'fecha_solicitud',
    type: 'TIMESTAMP',
    description: { es: 'Cuándo se pidió.', en: 'When it was requested.' },
  },
  {
    name: 'fecha_factura',
    type: 'TIMESTAMP',
    description: { es: 'Cuándo se facturó.', en: 'When it was invoiced.' },
  },
  {
    name: 'fecha_despacho',
    type: 'TIMESTAMP',
    description: { es: 'Cuándo lo recogió la transportadora.', en: 'When the carrier picked it up.' },
  },
  {
    name: 'fecha_entrega_estimada',
    type: 'TIMESTAMP',
    description: { es: 'Fecha prometida de entrega.', en: 'Promised delivery date.' },
  },
  {
    name: 'fecha_entrega',
    type: 'TIMESTAMP',
    description: {
      es: 'Cuándo se entregó. NULL si sigue en camino o se devolvió.',
      en: 'When it was delivered. NULL if still in transit or returned.',
    },
  },
  {
    name: 'estado',
    type: 'VARCHAR',
    description: {
      es: 'solicitado, facturado, despachado, en_transito, novedad, entregado o devuelto. Una guía puede tener varias filas, una por estado.',
      en: 'solicitado, facturado, despachado, en_transito, novedad, entregado or devuelto. A shipment can have several rows, one per status.',
    },
  },
  {
    name: 'es_reexpedicion',
    type: 'BOOLEAN',
    description: {
      es: 'El destino requiere una segunda transportadora.',
      en: 'The destination needs a second carrier.',
    },
  },
];
