/**
 * Formato de las celdas del SqlPlayground. Sin dependencias de Arrow: el motor
 * (`sql-engine.ts`) decide el tipo de cada columna y entrega valores simples.
 *
 * Tipos que devuelve DuckDB-WASM a través de Arrow:
 * - BIGINT (COUNT, ROW_NUMBER, RANK...) llega como `bigint`.
 * - DOUBLE llega como `number`.
 * - DECIMAL llega como objeto BigNum; el motor lo pasa a texto con su escala.
 * - TIMESTAMP llega como milisegundos desde 1970 (sin zona horaria).
 */
export type ColumnKind =
  | 'text'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'timestamp'
  | 'date'
  | 'boolean'
  | 'other';

/** Columnas que se alinean a la derecha en la tabla de resultados. */
export const isNumericKind = (kind: ColumnKind): boolean =>
  kind === 'integer' || kind === 'float' || kind === 'decimal';

/**
 * Arrow entrega un DECIMAL como su entero sin escalar (DECIMAL(5,2) 123.45 llega
 * como "12345"). Esto pone el punto decimal según la escala de la columna.
 */
export function scaleDecimal(unscaled: string, scale: number): string {
  if (scale <= 0) return unscaled;
  const negative = unscaled.startsWith('-');
  const digits = (negative ? unscaled.slice(1) : unscaled).padStart(scale + 1, '0');
  const int = digits.slice(0, -scale);
  const frac = digits.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatTimestamp(ms: number, withTime: boolean): string {
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (!withTime) return date;
  const seconds = d.getUTCSeconds() ? `:${pad(d.getUTCSeconds())}` : '';
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds}`;
}

/**
 * Texto de una celda, o `null` si el valor es SQL NULL (la tabla lo muestra
 * aparte). Los números se muestran como en un cliente SQL: con punto decimal y
 * sin separador de miles, para que se puedan copiar tal cual.
 */
export function formatCell(value: unknown, kind: ColumnKind): string | null {
  if (value === null || value === undefined) return null;

  switch (kind) {
    case 'timestamp':
    case 'date': {
      const ms = typeof value === 'bigint' ? Number(value) : value;
      if (typeof ms === 'number' && Number.isFinite(ms)) return formatTimestamp(ms, kind === 'timestamp');
      if (ms instanceof Date) return formatTimestamp(ms.getTime(), kind === 'timestamp');
      return String(value);
    }
    case 'float': {
      if (typeof value !== 'number') return String(value);
      if (!Number.isFinite(value)) return String(value);
      return String(Number.parseFloat(value.toFixed(4)));
    }
    case 'integer':
    case 'decimal':
    case 'boolean':
    case 'text':
      return String(value);
    default:
      return typeof value === 'object' ? JSON.stringify(value, (_, v: unknown) => (typeof v === 'bigint' ? String(v) : v)) : String(value);
  }
}
