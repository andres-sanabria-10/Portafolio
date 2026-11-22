import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSqlFile, toPlaygroundQueries } from './sql-queries';

describe('parseSqlFile', () => {
  it('toma la primera línea de comentario como título y el resto como descripción', () => {
    const query = parseSqlFile(
      '/scripts/queries/02_ranking.sql',
      '-- Ranking con RANK().\n-- Deja huecos\n--   si hay empates.\nSELECT 1;\n-- comentario interno\n',
    );
    expect(query).toEqual({
      id: '02_ranking',
      title: 'Ranking con RANK()',
      description: 'Deja huecos si hay empates.',
      sql: '-- Ranking con RANK().\n-- Deja huecos\n--   si hay empates.\nSELECT 1;\n-- comentario interno',
    });
  });

  it('normaliza los saltos de línea de Windows', () => {
    expect(parseSqlFile('a.sql', '-- Título\r\nSELECT 1;\r\n').sql).toBe('-- Título\nSELECT 1;');
  });

  it('usa el nombre del archivo si no hay comentarios', () => {
    const query = parseSqlFile('C:\\q\\03_tiempos.sql', 'SELECT 1;');
    expect(query.title).toBe('03_tiempos');
    expect(query.description).toBe('');
  });
});

describe('toPlaygroundQueries', () => {
  it('ordena por nombre de archivo', () => {
    const ids = toPlaygroundQueries({ 'b/02_b.sql': '-- B', 'b/01_a.sql': '-- A' }).map((q) => q.id);
    expect(ids).toEqual(['01_a', '02_b']);
  });

  it('lee las consultas reales de scripts/queries con título y descripción', () => {
    const dir = join(process.cwd(), 'scripts', 'queries');
    const files = Object.fromEntries(
      readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
    );
    const queries = toPlaygroundQueries(files);
    expect(queries.length).toBeGreaterThanOrEqual(4);
    for (const query of queries) {
      expect(query.title.length).toBeGreaterThan(5);
      expect(query.description.length).toBeGreaterThan(10);
      expect(query.sql).toMatch(/\bFROM\s+envios\b/i);
    }
  });
});
