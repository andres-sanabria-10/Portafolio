-- El error de contar filas en vez de guías.
-- "Ingenuo": cuenta cada fila con fecha de entrega, y una guía con varios estados pesa varias veces.
-- "Correcto": una fila por guía (TRIM + último estado).
-- Las guías con novedad reportan más estados, así que el OTD ingenuo siempre sale más bajo.
WITH orden_estado(estado, orden) AS (
    VALUES ('solicitado', 1), ('facturado', 2), ('despachado', 3), ('en_transito', 4),
           ('novedad', 5), ('entregado', 6), ('devuelto', 7)
),
ingenuo AS (
    SELECT
        transportadora,
        COUNT(*) AS filas_contadas,
        100.0 * COUNT(*) FILTER (WHERE fecha_entrega <= fecha_entrega_estimada) / COUNT(*) AS otd_pct
    FROM envios
    WHERE fecha_entrega IS NOT NULL
    GROUP BY transportadora
),
ultimo_estado AS (
    SELECT TRIM(e.guia) AS guia_limpia, e.*
    FROM envios AS e
    JOIN orden_estado AS o USING (estado)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY TRIM(e.guia) ORDER BY o.orden DESC) = 1
),
correcto AS (
    SELECT
        transportadora,
        COUNT(*) AS guias_entregadas,
        100.0 * COUNT(*) FILTER (WHERE fecha_entrega <= fecha_entrega_estimada) / COUNT(*) AS otd_pct
    FROM ultimo_estado
    WHERE estado = 'entregado'
    GROUP BY transportadora
)
SELECT
    c.transportadora,
    i.filas_contadas,
    c.guias_entregadas,
    i.filas_contadas - c.guias_entregadas   AS filas_de_mas,
    ROUND(i.otd_pct, 2)                     AS otd_ingenuo_pct,
    ROUND(c.otd_pct, 2)                     AS otd_correcto_pct,
    ROUND(i.otd_pct - c.otd_pct, 2)         AS diferencia_pp
FROM correcto AS c
JOIN ingenuo AS i USING (transportadora)
ORDER BY diferencia_pp;
