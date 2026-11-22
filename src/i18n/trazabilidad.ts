import type { Lang } from './config';

/**
 * Contenido del diagrama de arquitectura del caso "Trazabilidad de punta a
 * punta del pedido" (TraceabilityFlow.vue).
 *
 * Confidencialidad: solo nombres genéricos (Transportadora A–G, fact_envios,
 * dim_transportadora, dim_ciudad). Nada de nombres reales de transportadoras,
 * clientes, tablas, bases de datos o servidores.
 *
 * La versión en inglés llega en la fase 5; mientras tanto se usa la española.
 */
export type Protocol = 'REST' | 'SOAP';

export interface TraceLane {
  id: string;
  title: string;
}

export interface TraceStage {
  id: string;
  lane: string;
  title: string;
  subtitle: string;
  inputs: string;
  transform: string;
  problem: string;
  tech: string[];
  carriers?: { name: string; protocol: Protocol }[];
}

export interface TraceabilityContent {
  lanes: TraceLane[];
  stages: TraceStage[];
}

// TODO(Andrés): confirmar cuántas transportadoras usan REST y cuántas SOAP. Las
// letras son genéricas, así que basta con que la proporción sea la real.
const carriers: { name: string; protocol: Protocol }[] = [
  { name: 'Transportadora A', protocol: 'REST' },
  { name: 'Transportadora B', protocol: 'SOAP' },
  { name: 'Transportadora C', protocol: 'REST' },
  { name: 'Transportadora D', protocol: 'SOAP' },
  { name: 'Transportadora E', protocol: 'REST' },
  { name: 'Transportadora F', protocol: 'REST' },
  { name: 'Transportadora G', protocol: 'SOAP' },
];

const es: TraceabilityContent = {
  lanes: [
    { id: 'origen', title: 'Sistemas de origen' },
    { id: 'transportadoras', title: 'Transportadoras' },
    { id: 'pipeline', title: 'Pipeline en Python' },
    { id: 'consumo', title: 'Almacén y consumo' },
  ],
  stages: [
    {
      id: 'solicitud',
      lane: 'origen',
      title: 'Solicitud en el contact center',
      subtitle: 'Arranca el reloj del pedido',
      inputs:
        'El pedido que registra el contact center: número de solicitud, cliente, destino y la fecha y hora en que se pidió.',
      transform:
        'Se toma la fecha de solicitud como inicio del reloj del pedido y se conserva la llave de la solicitud para unirla después con la factura.',
      problem:
        'La solicitud vivía en un sistema distinto al de facturación y despacho, así que nadie podía decir cuánto tardaba un pedido desde que el cliente lo pedía hasta que lo recibía.',
      tech: ['Base de datos del contact center', 'SQL'],
    },
    {
      id: 'facturacion',
      lane: 'origen',
      title: 'Facturación en el ERP',
      subtitle: 'Factura + guía',
      inputs: 'La factura del pedido y el número de guía que se asigna al envío.',
      transform:
        'Se relacionan solicitud, factura y guía. La guía es la llave que conecta el pedido interno con lo que reporta la transportadora.',
      problem:
        'Algunas llaves de guía venían con espacios al inicio y rompían los cruces con los datos de las transportadoras. Ahora se limpian con TRIM antes de cualquier unión.',
      tech: ['ERP', 'T-SQL'],
    },
    {
      id: 'despacho',
      lane: 'origen',
      title: 'Despacho',
      subtitle: 'Entrega a la transportadora',
      inputs: 'La fecha y hora de despacho y la transportadora asignada a cada guía.',
      transform:
        'Se calcula el tiempo interno (de la factura al despacho) y queda registrada la fecha de entrega comprometida.',
      problem:
        'Separar el tiempo interno del tiempo de la transportadora, para saber de quién es cada demora.',
      tech: ['SQL Server', 'T-SQL'],
    },
    {
      id: 'apis',
      lane: 'transportadoras',
      title: 'APIs de transportadoras',
      subtitle: 'Siete integraciones distintas',
      inputs:
        'Los eventos que reporta cada transportadora para cada guía (recogida, en tránsito, novedad, entrega…), con su fecha y hora.',
      transform:
        'Cada transportadora expone su propia API: unas REST con JSON y otras SOAP con XML. Cada una se consulta con un adaptador propio que entrega el mismo formato de salida.',
      problem:
        'Siete integraciones con formatos, autenticación y nombres de estado diferentes. Sin adaptadores, cada transportadora nueva habría sido un caso especial en todo el pipeline.',
      tech: ['APIs REST (JSON)', 'Servicios SOAP (XML)'],
      carriers,
    },
    {
      id: 'ingesta',
      lane: 'pipeline',
      title: 'Ingesta en Python',
      subtitle: 'Del API a staging',
      inputs: 'Las guías despachadas que todavía no tienen un estado final.',
      transform:
        'Un proceso en Python consulta las APIs por lotes y guarda la respuesta cruda en tablas de staging, sin transformarla todavía.',
      problem:
        'Guardar el dato crudo permite reprocesar cuando cambia una regla de negocio, sin volver a llamar a las APIs de las transportadoras.',
      tech: ['Python', 'pandas', 'staging en SQL Server'],
    },
    {
      id: 'normalizacion',
      lane: 'pipeline',
      title: 'Normalización de estados',
      subtitle: 'Un modelo común',
      inputs: 'Los estados crudos de cada transportadora, cada una con su propio vocabulario.',
      transform:
        'Un mapeo por transportadora traduce cada estado a un modelo común (despachado, en tránsito, novedad, entregado, devuelto). Un estado sin mapeo no se descarta en silencio: se reporta para revisarlo.',
      problem:
        'Sin un modelo común no se podía comparar una transportadora con otra ni medir la entrega a tiempo con la misma regla para todas.',
      tech: ['Python', 'pandas'],
    },
    {
      id: 'reexpediciones',
      lane: 'pipeline',
      title: 'Detección de reexpediciones',
      subtitle: 'Destinos con segunda transportadora',
      inputs: 'Las guías normalizadas, con su destino y su transportadora.',
      transform:
        'Se marcan los envíos cuyo destino requiere una segunda transportadora para llegar.',
      problem:
        'Una reexpedición tarda más por naturaleza. Marcarla permite analizarla aparte en lugar de mezclarla con los envíos directos.',
      tech: ['Python', 'SQL'],
    },
    {
      id: 'fact',
      lane: 'consumo',
      title: 'fact_envios en SQL Server',
      subtitle: 'Una fila por guía',
      inputs:
        'Cada guía con las fechas de todas sus etapas, la transportadora, el estado final y la marca de reexpedición.',
      transform:
        'Se carga la tabla de hechos fact_envios, relacionada con dimensiones como dim_transportadora y dim_ciudad.',
      problem:
        'Tener una sola fuente de verdad, con una fila por guía, contra la que se valida cualquier indicador.',
      tech: ['SQL Server', 'Modelo estrella'],
    },
    {
      id: 'medicion',
      lane: 'consumo',
      title: 'Tiempos por etapa y ranking de OTD',
      subtitle: 'CTEs y window functions',
      inputs: 'fact_envios.',
      transform:
        'Consultas con CTEs y window functions calculan el tiempo de cada etapa, la entrega a tiempo (OTD) por transportadora y su posición con RANK().',
      problem:
        'Ubicar dónde se demora el pedido: en el proceso interno o en la transportadora.',
      tech: ['T-SQL', 'CTEs', 'Window functions'],
    },
    {
      id: 'powerbi',
      lane: 'consumo',
      title: 'Tablero en Power BI',
      subtitle: 'Validado contra SQL',
      inputs: 'El modelo de SQL Server.',
      transform:
        'Medidas DAX de OTD, tiempos por etapa y ranking, con filtros por transportadora, ciudad y mes.',
      problem:
        'Al validar el tablero contra SQL apareció una diferencia: una relación del modelo contaba guías repetidas, una vez por cada estado. Lo corregí con un filtro explícito en la medida y SQL quedó como la referencia para validar.',
      tech: ['Power BI', 'DAX'],
    },
  ],
};

const content: Partial<Record<Lang, TraceabilityContent>> = { es };

export function getTraceabilityContent(lang: Lang): TraceabilityContent {
  return content[lang] ?? es;
}
