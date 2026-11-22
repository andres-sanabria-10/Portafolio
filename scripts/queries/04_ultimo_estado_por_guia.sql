-- ROW_NUMBER() para quedarse con el último estado de cada guía.
-- Forma clásica con subconsulta y WHERE rn = 1: funciona igual en SQL Server.
-- El resultado compara las filas crudas con las guías reales en cada estado final.
WITH orden_estado(estado, orden) AS (
    VALUES ('solicitado', 1), ('facturado', 2), ('despachado', 3), ('en_transito', 4),
           ('novedad', 5), ('entregado', 6), ('devuelto', 7)
),
numerado AS (
    SELECT
        TRIM(e.guia) AS guia_limpia,
        e.estado,
        o.orden,
        ROW_NUMBER() OVER (PARTITION BY TRIM(e.guia) ORDER BY o.orden DESC) AS rn,
        COUNT(*)     OVER (PARTITION BY TRIM(e.guia))                       AS filas_de_la_guia
    FROM envios AS e
    JOIN orden_estado AS o USING (estado)
)
SELECT
    estado                                        AS estado_final,
    COUNT(*)                                      AS guias,
    SUM(filas_de_la_guia)                         AS filas_crudas,
    SUM(filas_de_la_guia) - COUNT(*)              AS filas_descartadas,
    COUNT(*) FILTER (WHERE filas_de_la_guia > 1)  AS guias_con_varios_estados
FROM numerado
WHERE rn = 1
GROUP BY estado, orden
ORDER BY orden;
