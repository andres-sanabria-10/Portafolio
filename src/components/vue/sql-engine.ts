/**
 * Motor del SqlPlayground: DuckDB-WASM corriendo en un Web Worker.
 *
 * Este módulo se importa de forma diferida (`import('./sql-engine')`) la primera
 * vez que alguien ejecuta una consulta, así que ni DuckDB ni Arrow pesan en la
 * carga inicial de la página.
 *
 * El binario de DuckDB (.wasm, ~33 MB sin comprimir) se descarga de jsDelivr
 * con la versión fijada en package.json: llega comprimido con Brotli y queda en
 * la caché del navegador. Servirlo desde este sitio obligaría a GitHub Pages a
 * entregarlo sin esa compresión.
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import { DataType, util, type Field, type Table } from 'apache-arrow';
import { formatCell, isNumericKind, scaleDecimal, type ColumnKind } from './sql-format';

export interface ResultColumn {
  name: string;
  numeric: boolean;
}

export interface QueryResult {
  columns: ResultColumn[];
  /** Celdas ya formateadas; `null` es SQL NULL. */
  rows: (string | null)[][];
  /** Filas que devolvió la consulta (puede ser mayor que `rows.length`). */
  total: number;
  ms: number;
}

export interface SqlEngine {
  run(sql: string, maxRows?: number): Promise<QueryResult>;
  close(): Promise<void>;
}

function kindOf(field: Field): ColumnKind {
  const { type } = field;
  if (DataType.isInt(type)) return 'integer';
  if (DataType.isFloat(type)) return 'float';
  if (DataType.isDecimal(type)) return 'decimal';
  if (DataType.isTimestamp(type)) return 'timestamp';
  if (DataType.isDate(type)) return 'date';
  if (DataType.isBool(type)) return 'boolean';
  if (DataType.isUtf8(type) || DataType.isLargeUtf8(type)) return 'text';
  return 'other';
}

function toResult(table: Table, maxRows: number, ms: number): QueryResult {
  const fields = table.schema.fields;
  const kinds = fields.map(kindOf);
  const scales = fields.map((f) => (DataType.isDecimal(f.type) ? f.type.scale : 0));
  const rows: (string | null)[][] = [];

  const limit = Math.min(table.numRows, maxRows);
  for (let r = 0; r < limit; r++) {
    const row = table.get(r);
    rows.push(
      fields.map((field, c) => {
        const raw: unknown = row?.[field.name];
        const kind = kinds[c]!;
        // DECIMAL llega como BigNum sin escalar: se pasa a texto y se le pone el punto.
        const value =
          kind === 'decimal' && raw !== null && raw !== undefined
            ? scaleDecimal(
                util.bigNumToString(raw as Parameters<typeof util.bigNumToString>[0]),
                scales[c] ?? 0,
              )
            : raw;
        return formatCell(value, kind);
      }),
    );
  }

  return {
    columns: fields.map((field, c) => ({ name: field.name, numeric: isNumericKind(kinds[c]!) })),
    rows,
    total: table.numRows,
    ms,
  };
}

/**
 * Arranca DuckDB, descarga el parquet y lo expone como la vista `envios`, que
 * es el nombre que usan las consultas de `scripts/queries`.
 */
export async function createSqlEngine(parquetUrl: string): Promise<SqlEngine> {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  // Un worker de otro origen no se puede crear directo: se envuelve en un Blob local.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }),
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  } finally {
    URL.revokeObjectURL(workerUrl);
  }

  const response = await fetch(parquetUrl);
  if (!response.ok) throw new Error(`No se pudo descargar ${parquetUrl} (HTTP ${response.status}).`);
  await db.registerFileBuffer('envios.parquet', new Uint8Array(await response.arrayBuffer()));

  const conn = await db.connect();
  await conn.query(`CREATE VIEW envios AS SELECT * FROM 'envios.parquet'`);

  return {
    async run(sql, maxRows = 200) {
      const start = performance.now();
      const table = await conn.query(sql);
      return toResult(table, maxRows, Math.round(performance.now() - start));
    },
    async close() {
      await conn.close();
      await db.terminate();
    },
  };
}
