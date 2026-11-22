import { describe, expect, it } from 'vitest';
import { formatCell, isNumericKind, scaleDecimal } from './sql-format';

describe('scaleDecimal', () => {
  it('pone el punto decimal según la escala', () => {
    expect(scaleDecimal('12345', 2)).toBe('123.45');
    expect(scaleDecimal('5', 3)).toBe('0.005');
    expect(scaleDecimal('-750', 2)).toBe('-7.5');
    expect(scaleDecimal('1200', 2)).toBe('12');
  });

  it('deja intactos los enteros (escala 0)', () => {
    expect(scaleDecimal('3105', 0)).toBe('3105');
  });
});

describe('formatCell', () => {
  it('devuelve null para SQL NULL', () => {
    expect(formatCell(null, 'integer')).toBeNull();
    expect(formatCell(undefined, 'text')).toBeNull();
  });

  it('muestra BIGINT sin perder precisión', () => {
    expect(formatCell(4164n, 'integer')).toBe('4164');
    expect(formatCell(9007199254740993n, 'integer')).toBe('9007199254740993');
  });

  it('recorta los decimales de DOUBLE sin ceros sobrantes', () => {
    expect(formatCell(97.93, 'float')).toBe('97.93');
    expect(formatCell(2 / 3, 'float')).toBe('0.6667');
    expect(formatCell(-7.19, 'float')).toBe('-7.19');
    expect(formatCell(0, 'float')).toBe('0');
  });

  it('formatea TIMESTAMP en UTC, que es como lo guarda el parquet', () => {
    // 2025-07-01 07:00 UTC, primera fila del dataset sintético.
    expect(formatCell(1751353200000, 'timestamp')).toBe('2025-07-01 07:00');
    expect(formatCell(1751353230000, 'timestamp')).toBe('2025-07-01 07:00:30');
    expect(formatCell(1751353200000, 'date')).toBe('2025-07-01');
  });

  it('respeta el texto que ya trae DECIMAL desde el motor', () => {
    expect(formatCell('3105', 'decimal')).toBe('3105');
  });

  it('muestra booleanos y texto tal cual', () => {
    expect(formatCell(false, 'boolean')).toBe('false');
    expect(formatCell('Transportadora A', 'text')).toBe('Transportadora A');
  });

  it('serializa estructuras con bigint dentro', () => {
    expect(formatCell({ n: 2n }, 'other')).toBe('{"n":"2"}');
  });
});

describe('isNumericKind', () => {
  it('identifica las columnas que van a la derecha', () => {
    expect(isNumericKind('integer')).toBe(true);
    expect(isNumericKind('decimal')).toBe(true);
    expect(isNumericKind('timestamp')).toBe(false);
  });
});
