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

// Proporción real del pipeline: 6 APIs REST (JSON) y 1 servicio web SOAP (XML).
// Las letras son genéricas y no corresponden a ninguna transportadora real.
const carriers: { name: string; protocol: Protocol }[] = [
  { name: 'Transportadora A', protocol: 'REST' },
  { name: 'Transportadora B', protocol: 'REST' },
  { name: 'Transportadora C', protocol: 'REST' },
  { name: 'Transportadora D', protocol: 'SOAP' },
  { name: 'Transportadora E', protocol: 'REST' },
  { name: 'Transportadora F', protocol: 'REST' },
  { name: 'Transportadora G', protocol: 'REST' },
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
      id: 'facturacion',
      lane: 'origen',
      title: 'Facturación en el ERP',
      subtitle: 'Arranca el reloj del envío',
      inputs:
        'La factura del envío, con su valor de venta, y el número de guía que se le asigna.',
      transform:
        'La fecha de la factura marca el inicio del reloj del envío. Factura y guía quedan relacionadas: la guía es la llave que conecta lo interno con lo que reporta la transportadora, y la factura aporta el valor de venta para comparar el flete.',
      problem:
        'Algunas llaves de guía venían con espacios al inicio y rompían los cruces con los datos de las transportadoras. Ahora se limpian con TRIM antes de cualquier unión.',
      tech: ['ERP', 'T-SQL'],
    },
    {
      id: 'despacho',
      lane: 'origen',
      title: 'Despacho',
      subtitle: 'Entrega a la transportadora',
      inputs:
        'La fecha y hora de despacho, la transportadora asignada, el peso y el valor del flete de cada guía.',
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
        'Las guías, los eventos de seguimiento (recogida, tránsito, entrega) con su fecha y hora, y datos como peso, cajas y flete.',
      transform:
        'Cada transportadora expone su propia API: seis REST con JSON y una SOAP con XML, con autenticación distinta (token, llave en parámetros, login con JWT). Cada una tiene un adaptador propio que entrega el mismo formato de salida, y todas comparten un cliente HTTP con reintentos.',
      problem:
        'Siete integraciones con formatos, límites y nombres de estado diferentes. El cliente HTTP reintenta con espera exponencial ante cortes y límites de peticiones (429, respetando Retry-After) y renueva el token una vez si vence (401/403), así un fallo pasajero no tumba la corrida.',
      tech: ['APIs REST (JSON)', 'SOAP (XML)', 'requests'],
      carriers,
    },
    {
      id: 'ingesta',
      lane: 'pipeline',
      title: 'Ingesta incremental (raw)',
      subtitle: 'Solo lo nuevo, guardado tal cual',
      inputs:
        'Las guías creadas desde la última carga y las guías que todavía no tienen estado final.',
      transform:
        'Cada corrida parte de la última fecha cargada (marca de agua) y pide a las APIs solo lo nuevo, en ventanas de fechas contiguas. La respuesta se guarda cruda, con la fecha de carga, antes de cualquier transformación.',
      problem:
        'Una de las APIs tomaba la fecha final del rango como exclusiva: al paginar con un día de más se perdía 1 de cada 3 días. Lo detecté validando cuántas guías quedaban sin flete y lo corregí con ventanas contiguas. Guardar el crudo permite reprocesar sin volver a llamar a las APIs.',
      tech: ['Python', 'Programador de tareas (cada 4 h)', 'Capa raw'],
    },
    {
      id: 'staging',
      lane: 'pipeline',
      title: 'Staging: limpieza y tipos',
      subtitle: 'Las reglas de limpieza en un solo lugar',
      inputs: 'La respuesta cruda de cada transportadora.',
      transform:
        'Se parsean las fechas de cada formato, se limpian las llaves (TRIM y puntuación sobrante), se normalizan las ciudades (mayúsculas, sin tildes) y se usan NULL en lugar de valores de relleno. Las cargas son idempotentes: volver a correr no duplica guías ni eventos, y un campo vacío en la API no borra uno que ya existía.',
      problem:
        'Algunos NIT llegaban con el dígito de verificación pegado y no cabían en la columna entera: se separan en staging. Tener la limpieza aquí, y no repartida entre scripts y el tablero, hace que cada regla exista una sola vez.',
      tech: ['Python', 'SQL Server', 'Cargas idempotentes'],
    },
    {
      id: 'normalizacion',
      lane: 'pipeline',
      title: 'Normalización de estados',
      subtitle: 'Un modelo común',
      inputs: 'Los estados crudos de cada transportadora, cada una con su propio vocabulario.',
      transform:
        'Una tabla de mapeo versionada (transportadora, estado de origen, estado común) traduce cada estado a un modelo común: recogida, en tránsito y entregado. Un estado que no está en la tabla se reporta para revisarlo, no pasa en silencio.',
      problem:
        'Cada transportadora llama distinto a lo mismo (una dice "ENTREGADO", otra "Entrega", otra "ENTREGA VERIFICADA"). Sin un modelo común no se podía comparar una con otra ni medir la entrega a tiempo con la misma regla.',
      tech: ['SQL', 'Tabla de mapeo'],
    },
    {
      id: 'reexpediciones',
      lane: 'pipeline',
      title: 'Reexpediciones y fecha prometida',
      subtitle: 'Reglas de negocio centralizadas',
      inputs: 'Las guías limpias, con su destino y la fecha de su primer estado.',
      transform:
        'Una tabla de referencia marca los destinos que requieren una segunda transportadora y su tiempo adicional. La fecha prometida se calcula igual para todas: primer estado más 2 días a ciudades principales o 3 al resto.',
      problem:
        'Cada transportadora prometía con su propio criterio, así que el cumplimiento no era comparable. Una sola regla de fecha prometida y una referencia de reexpediciones permiten medir a todas por igual y analizar aparte los envíos que tardan más por naturaleza.',
      tech: ['Python', 'SQL', 'Tablas de referencia'],
    },
    {
      id: 'fact',
      lane: 'consumo',
      title: 'fact_envios en SQL Server',
      subtitle: 'Una fila por guía',
      inputs: 'Las guías y los eventos ya limpios y con estado común.',
      transform:
        'fact_eventos_guia guarda una fila por evento. fact_envios guarda una fila por guía con su último estado (una sola regla, determinista) y la fecha de cada etapa ya calculada, relacionada con dim_transportadora y dim_ciudad.',
      problem:
        'Tener una sola fuente de verdad, con una fila por guía, contra la que se valida cualquier indicador. Con las fechas de etapa en la tabla, las métricas no se recalculan en cada consulta del tablero.',
      tech: ['SQL Server', 'Modelo estrella'],
    },
    {
      id: 'medicion',
      lane: 'consumo',
      title: 'Tiempos por ruta, OTD y flete vs venta',
      subtitle: 'Comparar en igualdad de condiciones',
      inputs: 'fact_envios.',
      transform:
        'Consultas con CTEs y window functions calculan el tiempo de cada etapa por ruta (origen–destino) y transportadora, la entrega a tiempo (OTD) con su ranking, y el flete frente a la venta, prorrateando el flete cuando una guía lleva varias facturas.',
      problem:
        'Comparar transportadoras solo entre las que atienden la misma ruta, ubicar dónde se demora el envío y ver si el flete supera la meta del 1 % de la venta. Cada métrica tiene una definición escrita, para que todos midan lo mismo.',
      tech: ['T-SQL', 'CTEs', 'Window functions'],
    },
    {
      id: 'powerbi',
      lane: 'consumo',
      title: 'Tablero en Power BI',
      subtitle: 'Validado contra SQL',
      inputs: 'Las tablas del modelo y las vistas de métricas de SQL Server, ya limpias.',
      transform:
        'Power BI importa del modelo sin volver a limpiar nada: las reglas ya se aplicaron en staging. Las medidas DAX solo agregan (OTD, tiempos por ruta y ranking, semáforo de flete vs venta), con filtros por fecha, transportadora, cliente, bodega de origen, destino y último estado.',
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
