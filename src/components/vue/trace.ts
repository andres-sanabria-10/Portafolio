/**
 * Lógica pura del diagrama de trazabilidad (TraceabilityFlow.vue): agrupar las
 * etapas por carril conservando su número global y moverse entre etapas.
 */
import type { TraceLane, TraceStage } from '../../i18n/trazabilidad';

export interface TraceLabels {
  label: string;
  hint: string;
  /** Admite `{n}` y `{total}`. */
  stageOf: string;
  inputs: string;
  transform: string;
  problem: string;
  tech: string;
  carriers: string;
  close: string;
  prev: string;
  next: string;
}

export interface NumberedStage {
  stage: TraceStage;
  /** Posición global, desde 0, en el orden del flujo. */
  index: number;
}

export interface LaneGroup {
  lane: TraceLane;
  items: NumberedStage[];
}

/**
 * Agrupa las etapas por carril en el orden de `lanes`. Las etapas mantienen su
 * número global (el del flujo completo), no el de su carril. Falla si una etapa
 * apunta a un carril que no existe, para no perderla en silencio.
 */
export function groupByLane(lanes: TraceLane[], stages: TraceStage[]): LaneGroup[] {
  const known = new Set(lanes.map((lane) => lane.id));
  const orphan = stages.find((stage) => !known.has(stage.lane));
  if (orphan) throw new Error(`La etapa "${orphan.id}" apunta al carril inexistente "${orphan.lane}".`);

  return lanes
    .map((lane) => ({
      lane,
      items: stages
        .map((stage, index) => ({ stage, index }))
        .filter(({ stage }) => stage.lane === lane.id),
    }))
    .filter((group) => group.items.length > 0);
}

/** Índice de la etapa vecina, o `null` en los extremos del flujo. */
export function neighborIndex(index: number, total: number, step: -1 | 1): number | null {
  const next = index + step;
  return next >= 0 && next < total ? next : null;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
