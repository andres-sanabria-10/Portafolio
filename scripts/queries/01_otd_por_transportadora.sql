-- OTD (entrega a tiempo) por transportadora, calculado sobre una fila por guía.
-- Antes de contar hay que arreglar dos cosas del dato crudo:
--   1. Llaves con espacios al inicio      -> TRIM(guia)
--   2. Varias filas por guía (una por estado) -> quedarse con el estado más avanzado
WITH orden_estado(estado, orden) AS (
    VALUES ('solicitado', 1), ('facturado', 2), ('despachado', 3), ('en_transito', 4),
           ('novedad', 5), ('entregado', 6), ('devuelto', 7)
),
limpio AS (
    SELECT TRIM(e.guia) AS guia_limpia, e.*, o.orden
    FROM envios AS e
    JOIN orden_estado AS o USING (estado)
),
ultimo_estado AS (
    SELECT *
    FROM limpio
    -- QUALIFY filtra sobre la función de ventana sin necesidad de subconsulta
    QUALIFY ROW_NUMBER() OVER (PARTITION BY guia_limpia ORDER BY orden DESC) = 1
)
SELECT
    transportadora,
    COUNT(*)                                                         AS entregas,
    COUNT(*) FILTER (WHERE fecha_entrega <= fecha_entrega_estimada)  AS entregas_a_tiempo,
    ROUND(100.0 * COUNT(*) FILTER (WHERE fecha_entrega <= fecha_entrega_estimada)
          / COUNT(*), 2)                                             AS otd_pct
FROM ultimo_estado
WHERE estado = 'entregado'
GROUP BY transportadora
ORDER BY otd_pct DESC;
