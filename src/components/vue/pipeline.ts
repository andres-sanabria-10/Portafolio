/**
 * Geometría y reglas de la animación del pipeline (`PipelineFlow.vue`).
 *
 * Es lógica pura, sin DOM ni Vue, para probarla con Vitest y para que el
 * servidor renderice exactamente el mismo SVG que luego anima el navegador.
 *
 * Modelo: los registros (puntos) recorren una pista recta que atraviesa todas
 * las etapas. Las cajas de las etapas se dibujan encima, así que un punto
 * "entra" en una etapa y "sale" por el otro lado. En la etapa de
 * transformación cambian de crudos a validados, y uno de cada `dropEvery`
 * no vuelve a salir: es un duplicado o un registro inválido que se filtra.
 */

export interface PipelineStage {
  id: string;
  label: string;
  detail: string;
}

export type Orientation = 'horizontal' | 'vertical';

export interface Point {
  x: number;
  y: number;
}

export interface StageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface Segment {
  from: Point;
  to: Point;
}

export interface PipelineLayout {
  orientation: Orientation;
  width: number;
  height: number;
  boxes: StageBox[];
  /** Tramos visibles entre una caja y la siguiente (llevan la flecha). */
  connectors: Segment[];
  /**
   * Pista que siguen los puntos: del centro de la primera etapa al de la
   * última, así los registros nacen en la fuente y desaparecen en el consumo.
   */
  track: Segment;
}

/** Medidas en unidades del viewBox. El texto del SVG escala con ellas. */
const HORIZONTAL = { width: 1100, height: 84, margin: 8, boxWidth: 156, boxHeight: 68 };
const VERTICAL = { width: 340, margin: 8, boxWidth: 260, boxHeight: 62, gap: 46 };

export function layoutPipeline(count: number, orientation: Orientation): PipelineLayout {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError(`Un pipeline necesita al menos 2 etapas (recibió ${count}).`);
  }
  return orientation === 'horizontal' ? layoutHorizontal(count) : layoutVertical(count);
}

function layoutHorizontal(count: number): PipelineLayout {
  const { width, height, margin, boxWidth, boxHeight } = HORIZONTAL;
  const step = (width - 2 * margin - boxWidth) / (count - 1);
  const cy = height / 2;
  const boxes = Array.from({ length: count }, (_, i) => {
    const cx = margin + boxWidth / 2 + i * step;
    return box(cx, cy, boxWidth, boxHeight);
  });
  return {
    orientation: 'horizontal',
    width,
    height,
    boxes,
    connectors: connect(boxes, 'horizontal'),
    track: trackThrough(boxes),
  };
}

function layoutVertical(count: number): PipelineLayout {
  const { width, margin, boxWidth, boxHeight, gap } = VERTICAL;
  const height = 2 * margin + count * boxHeight + (count - 1) * gap;
  const cx = width / 2;
  const boxes = Array.from({ length: count }, (_, i) => {
    const cy = margin + boxHeight / 2 + i * (boxHeight + gap);
    return box(cx, cy, boxWidth, boxHeight);
  });
  return {
    orientation: 'vertical',
    width,
    height,
    boxes,
    connectors: connect(boxes, 'vertical'),
    track: trackThrough(boxes),
  };
}

function trackThrough(boxes: StageBox[]): Segment {
  const first = boxes[0]!;
  const last = boxes[boxes.length - 1]!;
  return { from: { x: first.cx, y: first.cy }, to: { x: last.cx, y: last.cy } };
}

function box(cx: number, cy: number, width: number, height: number): StageBox {
  return { x: cx - width / 2, y: cy - height / 2, width, height, cx, cy };
}

function connect(boxes: StageBox[], orientation: Orientation): Segment[] {
  return boxes.slice(1).map((next, i) => {
    const prev = boxes[i]!;
    return orientation === 'horizontal'
      ? { from: { x: prev.x + prev.width, y: prev.cy }, to: { x: next.x, y: next.cy } }
      : { from: { x: prev.cx, y: prev.y + prev.height }, to: { x: next.cx, y: next.y } };
  });
}

/** Punto de la pista a una fracción `t` (0 = inicio, 1 = final) de su longitud. */
export function pointOnTrack(track: Segment, t: number): Point {
  const k = Math.min(1, Math.max(0, t));
  return {
    x: track.from.x + (track.to.x - track.from.x) * k,
    y: track.from.y + (track.to.y - track.from.y) * k,
  };
}

/** Fracción de la pista donde queda el centro de una etapa. */
export function stageFraction(layout: PipelineLayout, index: number): number {
  const target = layout.boxes[index];
  if (!target) throw new RangeError(`No existe la etapa ${index}.`);
  const { from, to } = layout.track;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.hypot(target.cx - from.x, target.cy - from.y) / length;
}

/**
 * Avance (0–1) del punto `index` de `total` en el segundo `time`, si un punto
 * tarda `duration` segundos en recorrer la pista. Los puntos salen escalonados
 * para que siempre haya registros repartidos por todo el pipeline.
 */
export function dotProgress(time: number, index: number, total: number, duration: number): number {
  if (total <= 0 || duration <= 0) return 0;
  const raw = time / duration + index / total;
  return raw - Math.floor(raw);
}

export interface DotAppearance {
  /** `false` mientras el punto todavía no pasa por la transformación. */
  validated: boolean;
  /** `false` para un registro filtrado, desde que entra a la transformación. */
  visible: boolean;
}

/**
 * Cómo se ve un punto según dónde está. Uno de cada `dropEvery` puntos es un
 * registro que la transformación descarta: entra a la caja y ya no sale.
 */
export function dotAppearance(
  progress: number,
  index: number,
  transformAt: number,
  dropEvery: number,
): DotAppearance {
  const passed = progress >= transformAt;
  const dropped = dropEvery > 0 && index % dropEvery === dropEvery - 1;
  return { validated: passed, visible: !(dropped && passed) };
}
