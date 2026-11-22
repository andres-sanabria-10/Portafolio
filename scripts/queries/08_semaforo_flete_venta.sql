-- Semáforo de flete vs venta (meta 1 %).
-- La meta: ningún flete debe superar el 1 % del valor de la venta que transporta.
-- Por transportadora: cuántas guías quedan en rojo, el % de flete sobre la venta y
-- cuántos pesos, en total, se pasan de la meta. Solo cuentan las guías ya despachadas.
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
semaforo AS (
    SELECT
        transportadora,
        valor_venta,
        valor_flete,
        CASE WHEN valor_flete <= 0.01 * valor_venta THEN 'verde' ELSE 'rojo' END AS color
    FROM ultimo_estado
    WHERE valor_flete IS NOT NULL
)
SELECT
    transportadora,
    COUNT(*)                                                         AS guias,
    COUNT(*) FILTER (WHERE color = 'rojo')                           AS guias_en_rojo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE color = 'rojo') / COUNT(*), 2) AS pct_en_rojo,
    ROUND(100.0 * SUM(valor_flete) / SUM(valor_venta), 2)            AS flete_pct_venta,
    ROUND(SUM(CASE WHEN color = 'rojo' THEN valor_flete - 0.01 * valor_venta ELSE 0 END), 0)
                                                                     AS pesos_sobre_la_meta
FROM semaforo
GROUP BY transportadora
ORDER BY pct_en_rojo DESC;
