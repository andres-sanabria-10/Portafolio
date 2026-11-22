-- Ranking de transportadoras por OTD con RANK().
-- RANK() deja huecos si hay empates (1, 2, 2, 4); DENSE_RANK() no los deja.
-- La última columna compara cada transportadora con la mejor del ranking.
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
otd AS (
    SELECT
        transportadora,
        COUNT(*) AS entregas,
        ROUND(100.0 * AVG(CASE WHEN fecha_entrega <= fecha_entrega_estimada THEN 1 ELSE 0 END), 2)
            AS otd_pct
    FROM ultimo_estado
    WHERE estado = 'entregado'
    GROUP BY transportadora
)
SELECT
    RANK() OVER (ORDER BY otd_pct DESC)             AS puesto,
    transportadora,
    entregas,
    otd_pct,
    ROUND(otd_pct - MAX(otd_pct) OVER (), 2)        AS pp_frente_al_mejor
FROM otd
ORDER BY puesto, transportadora;
