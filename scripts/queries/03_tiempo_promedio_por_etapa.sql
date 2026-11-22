-- ¿Dónde se demora un pedido? Horas promedio de cada etapa por transportadora.
-- Las etapas sin terminar tienen la fecha final en NULL y AVG las ignora.
WITH orden_estado(estado, orden) AS (
    VALUES ('solicitado', 1), ('facturado', 2), ('despachado', 3), ('en_transito', 4),
           ('novedad', 5), ('entregado', 6), ('devuelto', 7)
),
ultimo_estado AS (
    SELECT TRIM(e.guia) AS guia_limpia, e.*
    FROM envios AS e
    JOIN orden_estado AS o USING (estado)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY TRIM(e.guia) ORDER BY o.orden DESC) = 1
)
SELECT
    transportadora,
    COUNT(*)                                                                   AS envios,
    ROUND(AVG(date_diff('minute', fecha_solicitud, fecha_factura)) / 60.0, 1)  AS h_solicitud_a_factura,
    ROUND(AVG(date_diff('minute', fecha_factura, fecha_despacho)) / 60.0, 1)   AS h_factura_a_despacho,
    ROUND(AVG(date_diff('minute', fecha_despacho, fecha_entrega)) / 60.0, 1)   AS h_despacho_a_entrega,
    ROUND(AVG(date_diff('minute', fecha_solicitud, fecha_entrega)) / 1440.0, 2) AS dias_de_punta_a_punta
FROM ultimo_estado
GROUP BY transportadora
ORDER BY dias_de_punta_a_punta;
