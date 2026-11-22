import { describe, expect, it } from 'vitest';
import resumen from '../../../public/data/envios_resumen.json';
import {
  buildCostMatrix,
  buildRouteMatrix,
  carrierLetter,
  formatCop,
  formatNumber,
  type FreightSummary,
  type RouteTimes,
} from './dashboard';

const route = (ruta: string, carriers: [string, number, number][]): RouteTimes => ({
  ruta,
  origen: ruta.split(' → ')[0]!,
  destino: ruta.split(' → ')[1]!,
  entregas: carriers.length * 30,
  transportadoras: carriers.map(([transportadora, dias_promedio, puesto]) => ({
    transportadora,
    dias_promedio,
    puesto,
    entregas: 30,
  })),
});

describe('buildRouteMatrix', () => {
  it('arma columnas con todas las transportadoras y marca la más rápida de cada ruta', () => {
    const matrix = buildRouteMatrix([
      route('Bogotá → Cali', [
        ['Transportadora B', 1.6, 2],
        ['Transportadora A', 1.4, 1],
      ]),
      route('Cali → Bogotá', [
        ['Transportadora C', 1.5, 1],
        ['Transportadora A', 1.5, 1],
      ]),
    ]);
    expect(matrix.carriers).toEqual(['Transportadora A', 'Transportadora B', 'Transportadora C']);
    expect(matrix.rows[0]!.cells.map((c) => c?.fastest ?? null)).toEqual([true, false, null]);
    // Empate en el primer puesto: las dos quedan resaltadas.
    expect(matrix.rows[1]!.cells.map((c) => c?.fastest ?? null)).toEqual([true, null, true]);
  });
});

describe('buildCostMatrix', () => {
  it('ubica el costo por kg en su tipo de destino y transportadora', () => {
    const matrix = buildCostMatrix([
      { tipo_destino: 'principal', transportadora: 'Transportadora B', guias: 10, costo_kg: 1000 },
      { tipo_destino: 'principal', transportadora: 'Transportadora A', guias: 10, costo_kg: 1100 },
      { tipo_destino: 'apartada', transportadora: 'Transportadora A', guias: 10, costo_kg: 4000 },
    ]);
    expect(matrix.carriers).toEqual(['Transportadora A', 'Transportadora B']);
    expect(matrix.rows).toEqual([
      { tipo: 'principal', cells: [1100, 1000] },
      { tipo: 'apartada', cells: [4000, null] },
    ]);
  });
});

describe('formatos', () => {
  it('formatea pesos y números en cada idioma', () => {
    expect(formatCop(23996212, 'es').replace(/\s/g, ' ')).toMatch(/23\.996\.212/);
    expect(formatCop(23996212, 'en')).toMatch(/23,996,212/);
    expect(formatNumber(1.4, 'es', 2)).toBe('1,40');
    expect(formatNumber(1.4, 'en', 2)).toBe('1.40');
  });

  it('abrevia el nombre de la transportadora a su letra', () => {
    expect(carrierLetter('Transportadora G')).toBe('G');
  });
});

describe('datos sintéticos del sitio', () => {
  it('trae rutas compartidas y un semáforo coherente', () => {
    const routes = resumen.tiempos_por_ruta as RouteTimes[];
    const freight = resumen.flete_vs_venta as FreightSummary;
    expect(routes.length).toBeGreaterThan(0);
    for (const r of buildRouteMatrix(routes).rows) {
      expect(r.cells.filter((c) => c !== null).length).toBeGreaterThanOrEqual(2);
      expect(r.cells.some((c) => c?.fastest)).toBe(true);
    }
    expect(freight.meta_pct).toBe(1);
    expect(freight.general.pct_en_rojo).toBeGreaterThanOrEqual(15);
    expect(freight.general.pct_en_rojo).toBeLessThanOrEqual(25);
    const totalRed = freight.por_transportadora.reduce((sum, row) => sum + row.guias_en_rojo, 0);
    expect(totalRed).toBe(freight.general.guias_en_rojo);
  });
});
