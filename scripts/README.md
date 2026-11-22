# Datos sintéticos de envíos

`generate_sample_data.py` genera el dataset que usan el caso de trazabilidad, el
playground SQL (DuckDB-WASM) y los gráficos estáticos del sitio.

> **Todo es sintético.** Las transportadoras son genéricas ("Transportadora A" a
> "Transportadora G"), las guías son números aleatorios y ninguna cifra representa
> la operación de una empresa real. Lo único real son los nombres de ciudades
> colombianas, que son públicos. No presentes estos números como resultados reales.

## Cómo correrlo

Requiere Python 3.11 o superior. Desde la raíz del repositorio (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --group dev   # pip >= 25.1
.\.venv\Scripts\python.exe scripts\generate_sample_data.py
```

En macOS o Linux el intérprete del entorno es `.venv/bin/python`.
Si tu `pip` es anterior a 25.1: `python -m pip install --upgrade pip`.

| Parámetro | Por defecto | Qué controla |
| --- | --- | --- |
| `--seed` | `42` | Semilla. Misma semilla y parámetros, mismos archivos byte a byte. |
| `--envios` (alias `--rows`) | `20000` | Número de envíos, es decir, de guías únicas. |
| `--prop-duplicadas` | `0.12` | Proporción de guías que aparecen en varias filas. |
| `--prop-espacios` | `0.03` | Proporción de filas con espacios al inicio de `guia`. |
| `--output-dir` | `public/data` | Carpeta de salida. |

La reproducibilidad byte a byte vale para las mismas versiones de numpy, pandas y
pyarrow. El periodo es fijo (2025-07-01 a 2026-06-30) y no se usa el reloj del
sistema: la "fecha de generación" del JSON es la fecha de corte.

### Comprobaciones

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts\run_queries.py   # corre scripts/queries/*.sql con DuckDB
```

## Qué genera

| Archivo | Contenido |
| --- | --- |
| `public/data/envios_sinteticos.parquet` | 23.105 filas de 20.000 guías (ZSTD, unos 400 KiB). Es lo que consulta el playground. |
| `public/data/envios_resumen.json` | Agregados ya limpios para gráficos estáticos. |

Claves de `envios_resumen.json`:

- `metadatos`: semilla, filas, guías únicas, periodo y fecha de generación (fija).
- `calidad_sembrada`: conteo exacto de los problemas de calidad (ver abajo).
- `estados`: guías por estado final.
- `otd_por_transportadora`: ranking, entregas, OTD correcto (`otd_pct`), OTD contando
  duplicados (`otd_ingenuo_pct`), diferencia en puntos porcentuales y días de tránsito.
- `tiempo_promedio_por_etapa`: horas promedio por etapa, general y por transportadora.
- `volumen_por_mes`: envíos solicitados, entregados y OTD por mes.
- `reexpediciones`: total, porcentaje y los 10 destinos donde más se concentran.

## Diccionario de datos

Una fila es un envío en uno de sus estados. Lo normal es una fila por guía; las
guías duplicadas a propósito tienen dos o tres.

| Columna | Tipo | Nulos | Descripción |
| --- | --- | --- | --- |
| `guia` | texto | no | Llave del envío: `GS` + 9 dígitos. Algunas filas traen espacios al inicio. |
| `transportadora` | texto | no | `Transportadora A` a `Transportadora G`. |
| `ciudad_origen` | texto | no | Centro de distribución: Bogotá, Medellín, Cali o Barranquilla. |
| `ciudad_destino` | texto | no | Una de 32 ciudades: principales, intermedias o apartadas. |
| `fecha_solicitud` | timestamp | no | Cuándo se pidió el envío. |
| `fecha_factura` | timestamp | sí | Cuándo se facturó. |
| `fecha_despacho` | timestamp | sí | Cuándo lo recogió la transportadora. |
| `fecha_entrega_estimada` | timestamp | sí | Promesa de entrega: fin del día de despacho + 2, 3 o 6 días según el destino. Existe solo si hay despacho. |
| `fecha_entrega` | timestamp | sí | Cuándo se entregó. Nula si sigue en camino o se devolvió. |
| `estado` | texto | no | `solicitado`, `facturado`, `despachado`, `en_transito`, `novedad`, `entregado` o `devuelto`. |
| `es_reexpedicion` | booleano | no | El destino requiere una segunda transportadora. |

Reglas que cumple el dato:

- `fecha_solicitud <= fecha_factura <= fecha_despacho <= fecha_entrega`, y una
  etapa nunca tiene fecha si la anterior no la tiene.
- Nada ocurre después del corte (2026-06-30): los envíos recientes quedan en
  `solicitado`, `facturado`, `despachado`, `en_transito` o `novedad` (promesa vencida).
- Un envío está **a tiempo** si `fecha_entrega <= fecha_entrega_estimada`. El OTD se
  mide sobre guías entregadas.
- Cada transportadora tiene su propio perfil de tiempo de recogida, tiempo de
  tránsito, dispersión y devoluciones. Las reexpediciones se concentran en los
  destinos apartados (cerca del 70 % de esos envíos) y alargan el tránsito.
- Simplificaciones: no hay festivos y el tránsito corre también en fin de semana.

## Problemas de calidad sembrados

Están puestos a propósito y su tamaño es exacto, para poder demostrarlos en SQL.
Los conteos son los de la corrida por defecto (semilla 42).

| Problema | Parámetro | Tamaño exacto | Efecto si no se corrige |
| --- | --- | --- | --- |
| Guías duplicadas por estado | `--prop-duplicadas 0.12` | `round(0.12 × 20.000)` = 2.400 guías con 2 o 3 filas; 3.105 filas sobrantes | El OTD sale más bajo: hasta 7,19 puntos menos en la Transportadora D. |
| Espacios al inicio de `guia` | `--prop-espacios 0.03` | `round(0.03 × 23.105)` = 693 filas con 1 o 2 espacios | `COUNT(DISTINCT guia)` da 20.160 en vez de 20.000 y los cruces por llave fallan. |

Cómo están construidos los duplicados:

- Imitan el cruce de un envío con su historial de estados: la guía se repite una
  vez por estado y **las fechas se copian en todas sus filas**. Por eso puede
  haber una fila `en_transito` con `fecha_entrega`: el estado viene del historial
  y la fecha es un atributo del envío.
- Las filas extra llevan los estados inmediatamente anteriores al final (1 fila
  extra con probabilidad 0,7; 2 con 0,3).
- No se reparten al azar: los envíos con entrega tardía, novedad o devolución
  pesan 6 veces más, y los de la Transportadora D 4 veces más. Por eso contar
  filas en vez de guías siempre baja el OTD, y lo baja más en esa transportadora.

La limpieza correcta es `TRIM(guia)` y quedarse con el estado más avanzado de
cada guía (`deduplicar()` en Python, `ROW_NUMBER()` en SQL). Con `--prop-duplicadas 0
--prop-espacios 0` el dataset sale limpio.

## Consultas de ejemplo (`scripts/queries/`)

Dialecto DuckDB, sobre una vista `envios` creada desde el Parquet
(`CREATE VIEW envios AS SELECT * FROM read_parquet('envios_sinteticos.parquet')`).
Cada archivo es una sola sentencia y se limpia a sí misma.

| Archivo | Qué muestra |
| --- | --- |
| `01_otd_por_transportadora.sql` | CTE que limpia con `TRIM`, deduplica y calcula el OTD. |
| `02_ranking_otd.sql` | `RANK()` y distancia frente a la mejor transportadora. |
| `03_tiempo_promedio_por_etapa.sql` | Horas promedio de cada etapa por transportadora. |
| `04_ultimo_estado_por_guia.sql` | `ROW_NUMBER()` para quedarse con el último estado. |
| `05_variacion_mensual_lag.sql` | `LAG()` para la variación mensual de volumen y OTD. |
| `06_error_por_duplicados.sql` | OTD contando duplicados frente al OTD correcto. |

## Pruebas (`scripts/tests/`)

`pytest` comprueba la reproducibilidad (mismo DataFrame y mismos archivos byte a
byte), la coherencia de fechas y estados, la proporción exacta de los problemas
sembrados, que cada consulta SQL corre en DuckDB y que el OTD calculado en SQL
coincide con el del JSON.
