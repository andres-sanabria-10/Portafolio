/**
 * Lógica pura del tablero del caso de trazabilidad (TraceabilityDashboard.vue).
 * Los datos salen de `public/data/envios_resumen.json` (100 % sintéticos):
 * claves `tiempos_por_ruta` y `flete_vs_venta`.
 */

export interface RouteCarrier {
  transportadora: string;
  entregas: number;
  dias_promedio: number;
  puesto: number;
}

export interface RouteTimes {
  ruta: string;
  origen: string;
  destino: string;
  entregas: number;
  transportadoras: RouteCarrier[];
}

export interface FreightRow {
  transportadora?: string;
  guias: number;
  guias_en_rojo: number;
  pct_en_rojo: number;
  flete_pct_venta: number;
  pesos_sobre_la_meta: number;
}

export interface CostPerKg {
  tipo_destino: string;
  transportadora: string;
  guias: number;
  costo_kg: number;
}

export interface FreightSummary {
  meta_pct: number;
  general: FreightRow;
  por_transportadora: FreightRow[];
  costo_kg_por_destino: CostPerKg[];
}

export interface DashboardLabels {
  tablist: string;
  tabRoutes: string;
  tabFreight: string;
  badge: string;
  routesIntro: string;
  routesCaption: string;
  route: string;
  deliveries: string;
  fastest: string;
  noData: string;
  days: string;
  routesNote: string;
  freightIntro: string;
  freightCaption: string;
  carrier: string;
  shipments: string;
  red: string;
  green: string;
  freightOverSale: string;
  overTarget: string;
  costCaption: string;
  destination: string;
  destinationTypes: Record<string, string>;
  freightNote: string;
}

export interface MatrixCell {
  dias: number;
  entregas: number;
  fastest: boolean;
}

export interface MatrixRow {
  ruta: string;
  entregas: number;
  cells: (MatrixCell | null)[];
}

export interface RouteMatrix {
  carriers: string[];
  rows: MatrixRow[];
}

/**
 * Matriz ruta × transportadora. Las columnas son todas las transportadoras que
 * aparecen en alguna ruta, en orden alfabético; una celda vacía (`null`) es una
 * transportadora sin entregas suficientes en esa ruta. La más rápida de cada
 * ruta es la de puesto 1 (puede haber empate).
 */
export function buildRouteMatrix(routes: RouteTimes[]): RouteMatrix {
  const carriers = [...new Set(routes.flatMap((r) => r.transportadoras.map((t) => t.transportadora)))].sort(
    (a, b) => a.localeCompare(b),
  );
  const rows = routes.map((route) => {
    const byCarrier = new Map(route.transportadoras.map((t) => [t.transportadora, t]));
    return {
      ruta: route.ruta,
      entregas: route.entregas,
      cells: carriers.map((name) => {
        const data = byCarrier.get(name);
        return data ? { dias: data.dias_promedio, entregas: data.entregas, fastest: data.puesto === 1 } : null;
      }),
    };
  });
  return { carriers, rows };
}

export interface CostMatrix {
  carriers: string[];
  rows: { tipo: string; cells: (number | null)[] }[];
}

/** Costo del flete por kg: filas por tipo de destino (en el orden de llegada), columnas por transportadora. */
export function buildCostMatrix(costs: CostPerKg[]): CostMatrix {
  const carriers = [...new Set(costs.map((c) => c.transportadora))].sort((a, b) => a.localeCompare(b));
  const tipos = [...new Set(costs.map((c) => c.tipo_destino))];
  return {
    carriers,
    rows: tipos.map((tipo) => ({
      tipo,
      cells: carriers.map(
        (name) => costs.find((c) => c.tipo_destino === tipo && c.transportadora === name)?.costo_kg ?? null,
      ),
    })),
  };
}

const LOCALES = { es: 'es-CO', en: 'en-US' } as const;
type DashLang = keyof typeof LOCALES;

/** Pesos colombianos sin decimales: "$ 23.996.212" (es) / "COP 23,996,212" (en). */
export function formatCop(value: number, lang: DashLang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, lang: DashLang, digits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** "Transportadora A" -> "A", para encabezados de columna angostos. */
export const carrierLetter = (name: string): string => name.replace(/^Transportadora\s+/, '');
