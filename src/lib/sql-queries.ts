/**
 * Consultas de ejemplo del SqlPlayground. La fuente de verdad son los archivos
 * de `scripts/queries/*.sql` (los mismos que prueban los scripts de Python);
 * aquí solo se leen sus comentarios iniciales para mostrar título y descripción.
 */
export interface PlaygroundQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
}

/**
 * Convierte un archivo `.sql` en una consulta de ejemplo. Las líneas `--` del
 * inicio son la cabecera: la primera es el título y el resto la descripción.
 * El SQL se conserva completo, con sus comentarios, para mostrarlo en el editor.
 */
export function parseSqlFile(fileName: string, text: string): PlaygroundQuery {
  const id = fileName.replace(/^.*[\\/]/, '').replace(/\.sql$/i, '');
  const sql = text.replace(/\r\n/g, '\n').trim();

  const header: string[] = [];
  for (const line of sql.split('\n')) {
    const match = /^\s*--\s?(.*)$/.exec(line);
    if (!match) break;
    header.push(match[1]!.trim());
  }

  const [first = id, ...rest] = header.filter(Boolean);
  return {
    id,
    title: first.replace(/\.$/, ''),
    description: rest.join(' ').replace(/\s+/g, ' '),
    sql,
  };
}

/** Ordena por nombre de archivo (los archivos llevan prefijo numérico: 01_, 02_...). */
export function toPlaygroundQueries(files: Record<string, string>): PlaygroundQuery[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => parseSqlFile(path, text));
}
