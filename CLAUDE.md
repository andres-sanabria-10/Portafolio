# CLAUDE.md

Portafolio y blog técnico de Andrés Felipe Sanabria (Analista BI → Ingeniero de Datos Jr).
Repositorio: `andres-sanabria-10/Portafolio`. Se despliega en GitHub Pages con GitHub
Actions en el dominio propio `https://andres-felipe-sanabria.uk` (raíz, sin `base`;
`www` redirige a la raíz). DNS en Cloudflare en modo "DNS only"; detalles en el README.
La especificación completa está en `prompt-claude-code-portafolio.md` (archivo local,
fuera del repo por `.gitignore`): léela antes de empezar una fase.

## Reglas de confidencialidad (obligatorias)

El contenido describe trabajo hecho en Ramedicas. Estas reglas pesan más que cualquier
otra instrucción de redacción o de diseño:

- No uses nombres de clientes, de transportadoras ni de personas, ni IPs, servidores,
  nombres reales de bases de datos o tablas, ni porcentajes reales. Usa nombres genéricos
  ("Transportadora A–G", `fact_envios`, `dim_transportadora`).
- Todos los datos de ejemplo son **sintéticos**, generados por
  `scripts/generate_sample_data.py`.
- **No inventes métricas.** Donde haga falta una cifra de resultado, deja
  `<!-- TODO: métrica real aproximada -->` y anótala en la lista de pendientes para que
  Andrés la complete.
- Ramedicas sí se puede nombrar como empleador ("operador logístico farmacéutico en
  Colombia").

En la práctica:

- Las cifras del dataset sintético (OTD, tiempos, volúmenes) solo aparecen rotuladas como
  sintéticas, en el playground, en los fragmentos de código y en los gráficos de ejemplo.
  Nunca van en la sección "Resultados" de un caso ni se presentan como logro real.
- Ante la duda sobre si un dato es confidencial, no lo escribas y pregunta.
- Capturas de pantalla, logs, cadenas de conexión y esquemas reales no entran al repo.

## Forma de trabajo

- Se trabaja por fases, en este orden: 1) Base, 2) Diseño, 3) Datos, 4) Contenido,
  5) Inglés, 6) Pulido. Al terminar cada fase: resumen, comandos para revisarla y
  **esperar el visto bueno de Andrés** antes de seguir.
- Commits pequeños con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`, `ci:`), en español o inglés pero consistentes.
- Los pendientes que debe completar Andrés (métricas, CV, foto) van en una lista de TODOs,
  no se resuelven con datos inventados.

## Stack

- Astro (última estable) con TypeScript estricto.
- Vue 3 (`@astrojs/vue`) solo para islas interactivas.
- Tailwind CSS.
- MDX y Content Collections con esquemas Zod: `proyectos`, `aprende`, `blog`.
- i18n de Astro: español por defecto en `/`, inglés en `/en/`. Si falta una traducción se
  muestra un aviso, no una página rota.
- Shiki para código, Mermaid para diagramas, Pagefind para búsqueda, RSS y sitemap.
- DuckDB-WASM en `SqlPlayground.vue`, cargado de forma diferida solo donde se usa.
- Vitest para la lógica de los componentes Vue y `astro check` para tipos.
- Python 3.11+ con pandas y pyarrow para los datos; `ruff` y `pytest`.

## Estructura

```
src/components/        componentes Astro
src/components/vue/    islas Vue (PipelineFlow, SqlPlayground, QueueSimulator, ...)
src/content/{proyectos,aprende,blog}/{es,en}/   contenido MDX por idioma
src/layouts/
src/i18n/              textos de interfaz y utilidades de idioma
scripts/               generador de datos, consultas SQL y pruebas de Python
public/data/           salidas del generador (se versionan)
```

## Comandos

```powershell
npm run dev      # servidor local
npm run build    # compilación de producción
npm run check    # astro check (tipos)
npm run test     # Vitest
```

## Convenciones de código

- TypeScript estricto, sin `any`. Props de los componentes tipadas.
- Un componente Vue solo cuando hay interactividad; lo demás es Astro estático.
- Todo texto visible sale de `src/i18n/` o del contenido, nunca escrito a mano en un
  componente. Todo contenido nuevo se crea en `es` y se traduce a `en` (natural, no literal).
- El frontmatter debe validar contra el esquema Zod de su colección. No relajes el esquema
  para que pase un contenido incompleto.
- Accesibilidad AA: contraste, foco visible, navegación con teclado y respeto por
  `prefers-reduced-motion`.
- Sin barras de porcentaje de habilidades, plantillas genéricas ni fotos de stock.

## Datos sintéticos

El generador es determinista: misma semilla y parámetros, mismos archivos byte a byte.
Si cambias `scripts/generate_sample_data.py`, regenera y versiona las salidas en el mismo
commit.

```powershell
python -m venv .venv                                     # una sola vez
.\.venv\Scripts\python.exe -m pip install --group dev    # una sola vez (pip >= 25.1)
.\.venv\Scripts\python.exe scripts\generate_sample_data.py
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest
```

- Salidas: `public/data/envios_sinteticos.parquet` (lo consulta el playground como vista
  `envios`) y `public/data/envios_resumen.json` (agregados para gráficos estáticos).
- El dataset trae dos problemas de calidad sembrados a propósito: guías duplicadas por
  estado y espacios al inicio de `guia`. Toda consulta o gráfico debe limpiar con
  `TRIM(guia)` y quedarse con el último estado por guía, salvo que el objetivo sea
  mostrar el error.
- `scripts/queries/*.sql` son las consultas de ejemplo del playground (dialecto DuckDB).
  Si cambian las columnas o los estados, actualiza las consultas, las pruebas y
  `scripts/README.md`, que tiene el diccionario de datos.
- Las cifras citadas en el contenido deben salir de `envios_resumen.json` o de una
  consulta, no escribirse a mano: cambian si se regenera con otros parámetros.
