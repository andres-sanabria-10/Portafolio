"""Ejecuta las consultas de ``scripts/queries`` contra el Parquet y muestra los resultados.

Sirve para comprobar, fuera del navegador, que las consultas del playground corren
en DuckDB. Requiere el grupo de dependencias ``dev`` (paquete ``duckdb``).

Uso:
    python scripts/run_queries.py
    python scripts/run_queries.py --parquet otra/ruta.parquet
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

RAIZ = Path(__file__).resolve().parent.parent
DIR_CONSULTAS = RAIZ / "scripts" / "queries"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--parquet", type=Path, default=RAIZ / "public" / "data" / "envios_sinteticos.parquet"
    )
    args = parser.parse_args()

    con = duckdb.connect()
    con.execute(
        f"CREATE VIEW envios AS SELECT * FROM read_parquet('{args.parquet.resolve().as_posix()}')"
    )
    for consulta in sorted(DIR_CONSULTAS.glob("*.sql")):
        print(f"\n== {consulta.name} ==")
        con.sql(consulta.read_text(encoding="utf-8")).show(max_rows=20, max_width=160)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
