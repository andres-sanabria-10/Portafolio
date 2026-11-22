-- LAG() para comparar cada mes con el anterior: volumen de envíos y OTD.
-- El último mes tiene envíos aún en tránsito, así que su OTD es parcial.
WITH orden_estado(estado, orden) AS (
    VALUES ('solicitado', 1), ('facturado', 2), ('despachado', 3), ('en_transito', 4),
           ('novedad', 5), ('entregado', 6), ('devuelto', 7)
),
ultimo_estado AS (
    SELECT TRIM(e.guia) AS guia_limpia, e.*
    FROM envios AS e
    JOIN orden_estado AS o USING (estado)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY TRIM(e.guia) ORDER BY o.orden DESC) = 1
),
mensual AS (
    SELECT
        strftime(date_trunc('month', fecha_solicitud), '%Y-%m') AS mes,
        COUNT(*)                                                AS envios,
        ROUND(100.0 * COUNT(*) FILTER (WHERE fecha_entrega <= fecha_entrega_estimada)
              / NULLIF(COUNT(fecha_entrega), 0), 2)             AS otd_pct
    FROM ultimo_estado
    GROUP BY mes
)
SELECT
    mes,
    envios,
    LAG(envios) OVER (ORDER BY mes)                                      AS envios_mes_anterior,
    ROUND(100.0 * (envios - LAG(envios) OVER (ORDER BY mes))
          / LAG(envios) OVER (ORDER BY mes), 1)                          AS variacion_pct,
    otd_pct,
    ROUND(otd_pct - LAG(otd_pct) OVER (ORDER BY mes), 2)                 AS variacion_otd_pp
FROM mensual
ORDER BY mes;
