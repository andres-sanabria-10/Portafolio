import { describe, expect, it } from 'vitest';
import { getTraceabilityContent, type TraceStage } from '../../i18n/trazabilidad';
import { fillTemplate, groupByLane, neighborIndex } from './trace';

const stage = (id: string, lane: string): TraceStage => ({
  id,
  lane,
  title: id,
  subtitle: '',
  inputs: '',
  transform: '',
  problem: '',
  tech: [],
});

describe('groupByLane', () => {
  const lanes = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'vacio', title: 'Sin etapas' },
  ];

  it('agrupa en el orden de los carriles y conserva el número global', () => {
    const groups = groupByLane(lanes, [stage('s1', 'a'), stage('s2', 'b'), stage('s3', 'a')]);
    expect(groups.map((g) => [g.lane.id, g.items.map((i) => `${i.stage.id}#${i.index}`)])).toEqual([
      ['a', ['s1#0', 's3#2']],
      ['b', ['s2#1']],
    ]);
  });

  it('falla si una etapa apunta a un carril que no existe', () => {
    expect(() => groupByLane(lanes, [stage('s1', 'z')])).toThrow(/carril inexistente/);
  });
});

describe('neighborIndex', () => {
  it('se mueve dentro del flujo y se detiene en los extremos', () => {
    expect(neighborIndex(0, 10, 1)).toBe(1);
    expect(neighborIndex(0, 10, -1)).toBeNull();
    expect(neighborIndex(9, 10, 1)).toBeNull();
    expect(neighborIndex(9, 10, -1)).toBe(8);
  });
});

describe('fillTemplate', () => {
  it('reemplaza variables conocidas y deja las demás', () => {
    expect(fillTemplate('Etapa {n} de {total}', { n: 3, total: 10 })).toBe('Etapa 3 de 10');
    expect(fillTemplate('{x}', {})).toBe('{x}');
  });
});

describe('contenido del caso de trazabilidad', () => {
  const { lanes, stages } = getTraceabilityContent('es');

  it('tiene las 9 etapas del flujo (sin contact center) y todas caen en un carril', () => {
    expect(stages).toHaveLength(9);
    expect(stages[0]?.id).toBe('facturacion');
    expect(groupByLane(lanes, stages).flatMap((g) => g.items)).toHaveLength(9);
  });

  it('cada etapa explica entrada, transformación, problema y tecnología', () => {
    for (const s of stages) {
      expect(s.inputs.length, s.id).toBeGreaterThan(10);
      expect(s.transform.length, s.id).toBeGreaterThan(10);
      expect(s.problem.length, s.id).toBeGreaterThan(10);
      expect(s.tech.length, s.id).toBeGreaterThan(0);
    }
  });

  it('marca el protocolo de las 7 transportadoras con nombres genéricos', () => {
    const carriers = stages.flatMap((s) => s.carriers ?? []);
    expect(carriers.map((c) => c.name)).toEqual(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => `Transportadora ${l}`),
    );
    expect(new Set(carriers.map((c) => c.protocol))).toEqual(new Set(['REST', 'SOAP']));
  });
});
