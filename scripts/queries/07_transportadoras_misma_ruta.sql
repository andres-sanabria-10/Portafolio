-- Comparar transportadoras en la misma ruta.
-- Un promedio general castiga a quien atiende destinos lejanos: aquí solo se comparan
-- transportadoras que cubren la misma ruta (origen → destino), con al menos 20 entregas
-- en ella, y solo en rutas que atienden 2 o más. RANK() ordena dentro de cada ruta (1 = la más rápida).
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
por_ruta AS (
    SELECT
        ciudad_origen || ' → ' || ciudad_destino                                 AS ruta,
        transportadora,
        COUNT(*)                                                                 AS entregas,
        ROUND(AVG(date_diff('minute', fecha_despacho, fecha_entrega)) / 1440.0, 2) AS dias_promedio
    FROM ultimo_estado
    WHERE estado = 'entregado'
    GROUP BY ruta, transportadora
    HAVING COUNT(*) >= 20
),
comparables AS (
    SELECT
        *,
        COUNT(*)      OVER (PARTITION BY ruta) AS transportadoras_en_ruta,
        SUM(entregas) OVER (PARTITION BY ruta) AS entregas_de_la_ruta
    FROM por_ruta
)
SELECT
    ruta,
    transportadora,
    entregas,
    dias_promedio,
    RANK() OVER (PARTITION BY ruta ORDER BY dias_promedio)               AS puesto_en_ruta,
    ROUND(dias_promedio - MIN(dias_promedio) OVER (PARTITION BY ruta), 2) AS dias_frente_al_mejor
FROM comparables
WHERE transportadoras_en_ruta >= 2
ORDER BY entregas_de_la_ruta DESC, ruta, puesto_en_ruta, transportadora;
