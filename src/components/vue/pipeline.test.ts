import { describe, expect, it } from 'vitest';
import {
  dotAppearance,
  dotProgress,
  layoutPipeline,
  pointOnTrack,
  stageFraction,
  type Orientation,
  type StageBox,
} from './pipeline';

const orientations: Orientation[] = ['horizontal', 'vertical'];

const overlaps = (a: StageBox, b: StageBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('layoutPipeline', () => {
  it.each(orientations)('reparte 5 etapas sin solaparse y dentro del lienzo (%s)', (orientation) => {
    const layout = layoutPipeline(5, orientation);
    expect(layout.boxes).toHaveLength(5);
    expect(layout.connectors).toHaveLength(4);
    for (const [i, box] of layout.boxes.entries()) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
      const next = layout.boxes[i + 1];
      if (next) expect(overlaps(box, next)).toBe(false);
    }
  });

  it.each(orientations)('deja un tramo visible entre cada par de etapas (%s)', (orientation) => {
    for (const { from, to } of layoutPipeline(5, orientation).connectors) {
      expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeGreaterThan(20);
    }
  });

  it('crece en alto con el número de etapas en vertical', () => {
    expect(layoutPipeline(6, 'vertical').height).toBeGreaterThan(layoutPipeline(5, 'vertical').height);
  });

  it('acepta medidas propias sin solapar las cajas', () => {
    const layout = layoutPipeline(5, 'horizontal', { horizontal: { height: 112, boxWidth: 176, boxHeight: 96 } });
    expect(layout.height).toBe(112);
    expect(layout.boxes[0]!.height).toBe(96);
    for (const [i, box] of layout.boxes.entries()) {
      const next = layout.boxes[i + 1];
      if (next) expect(box.x + box.width).toBeLessThan(next.x);
    }
  });

  it('rechaza pipelines de menos de 2 etapas', () => {
    expect(() => layoutPipeline(1, 'horizontal')).toThrow(RangeError);
    expect(() => layoutPipeline(2.5, 'vertical')).toThrow(RangeError);
  });
});

describe('pointOnTrack', () => {
  const track = { from: { x: 0, y: 50 }, to: { x: 200, y: 50 } };

  it('interpola a lo largo de la pista', () => {
    expect(pointOnTrack(track, 0)).toEqual({ x: 0, y: 50 });
    expect(pointOnTrack(track, 0.25)).toEqual({ x: 50, y: 50 });
    expect(pointOnTrack(track, 1)).toEqual({ x: 200, y: 50 });
  });

  it('no se sale de los extremos', () => {
    expect(pointOnTrack(track, -1)).toEqual({ x: 0, y: 50 });
    expect(pointOnTrack(track, 2)).toEqual({ x: 200, y: 50 });
  });
});

describe('stageFraction', () => {
  it.each(orientations)('ordena las etapas a lo largo de la pista (%s)', (orientation) => {
    const layout = layoutPipeline(5, orientation);
    const fractions = layout.boxes.map((_, i) => stageFraction(layout, i));
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    // La pista nace en la primera etapa y muere en la última.
    expect(fractions[0]).toBeCloseTo(0);
    expect(fractions[4]).toBeCloseTo(1);
  });

  it('pone la etapa central en la mitad de la pista', () => {
    const layout = layoutPipeline(5, 'horizontal');
    expect(stageFraction(layout, 2)).toBeCloseTo(0.5);
  });

  it('falla con una etapa que no existe', () => {
    expect(() => stageFraction(layoutPipeline(5, 'horizontal'), 9)).toThrow(RangeError);
  });
});

describe('dotProgress', () => {
  it('escalona los puntos al inicio', () => {
    expect([0, 1, 2, 3].map((i) => dotProgress(0, i, 4, 10))).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('avanza con el tiempo y vuelve a empezar al terminar la pista', () => {
    expect(dotProgress(5, 0, 4, 10)).toBeCloseTo(0.5);
    expect(dotProgress(10, 0, 4, 10)).toBeCloseTo(0);
    expect(dotProgress(12.5, 1, 4, 10)).toBeCloseTo(0.5);
  });

  it('se queda quieto con parámetros inválidos', () => {
    expect(dotProgress(3, 0, 0, 10)).toBe(0);
    expect(dotProgress(3, 0, 4, 0)).toBe(0);
  });
});

describe('dotAppearance', () => {
  it('marca como validado un registro que ya pasó por la transformación', () => {
    expect(dotAppearance(0.2, 0, 0.5, 4)).toEqual({ validated: false, visible: true });
    expect(dotAppearance(0.7, 0, 0.5, 4)).toEqual({ validated: true, visible: true });
  });

  it('filtra uno de cada `dropEvery` registros desde la transformación', () => {
    expect(dotAppearance(0.2, 3, 0.5, 4).visible).toBe(true);
    expect(dotAppearance(0.7, 3, 0.5, 4).visible).toBe(false);
    expect(dotAppearance(0.7, 7, 0.5, 4).visible).toBe(false);
    expect(dotAppearance(0.7, 2, 0.5, 4).visible).toBe(true);
  });

  it('no filtra nada con dropEvery en 0', () => {
    expect(dotAppearance(0.9, 3, 0.5, 0).visible).toBe(true);
  });
});
