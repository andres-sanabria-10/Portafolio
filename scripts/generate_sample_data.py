"""Genera el dataset sintético de envíos que usa el portafolio.

Todo lo que sale de este script es inventado: las transportadoras son genéricas
("Transportadora A" a "Transportadora G"), las guías son números aleatorios y
ninguna cifra representa la operación de una empresa real. Lo único tomado del
mundo real son los nombres de ciudades colombianas, que son públicos.

El dataset trae dos problemas de calidad sembrados a propósito, con proporción
exacta y controlable por parámetro:

1. Guías duplicadas: una parte de las guías aparece en varias filas, una por
   estado reportado (como al cruzar el envío con su historial de estados).
2. Espacios al inicio de la llave ``guia`` en una parte de las filas.

Cada guía trae además su valor de venta, el valor del flete y el peso, para el
análisis de flete vs venta (meta: que ningún flete supere el 1 % de la venta).
Estas columnas se sortean con un generador aparte, así que agregarlas no cambia
ninguna de las demás columnas ni sus agregados.

Uso:
    python scripts/generate_sample_data.py
    python scripts/generate_sample_data.py --seed 7 --envios 5000 --output-dir tmp/
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# --------------------------------------------------------------------------- #
# Modelo de dominio
# --------------------------------------------------------------------------- #

ESTADOS: tuple[str, ...] = (
    "solicitado",
    "facturado",
    "despachado",
    "en_transito",
    "novedad",
    "entregado",
    "devuelto",
)
"""Modelo común de estados, en el orden en que avanza un envío."""

ORDEN_ESTADO: dict[str, int] = {estado: i for i, estado in enumerate(ESTADOS, start=1)}

COLUMNAS: tuple[str, ...] = (
    "guia",
    "transportadora",
    "ciudad_origen",
    "ciudad_destino",
    "fecha_solicitud",
    "fecha_factura",
    "fecha_despacho",
    "fecha_entrega_estimada",
    "fecha_entrega",
    "estado",
    "es_reexpedicion",
    "valor_venta",
    "valor_flete",
    "peso_kg",
)

ESQUEMA_PARQUET = pa.schema(
    [
        pa.field("guia", pa.string(), nullable=False),
        pa.field("transportadora", pa.string(), nullable=False),
        pa.field("ciudad_origen", pa.string(), nullable=False),
        pa.field("ciudad_destino", pa.string(), nullable=False),
        pa.field("fecha_solicitud", pa.timestamp("ms"), nullable=False),
        pa.field("fecha_factura", pa.timestamp("ms")),
        pa.field("fecha_despacho", pa.timestamp("ms")),
        pa.field("fecha_entrega_estimada", pa.timestamp("ms")),
        pa.field("fecha_entrega", pa.timestamp("ms")),
        pa.field("estado", pa.string(), nullable=False),
        pa.field("es_reexpedicion", pa.bool_(), nullable=False),
        pa.field("valor_venta", pa.int64()),
        pa.field("valor_flete", pa.int64()),
        pa.field("peso_kg", pa.float64()),
    ]
)

COLUMNAS_CATEGORICAS: tuple[str, ...] = (
    "transportadora",
    "ciudad_origen",
    "ciudad_destino",
    "estado",
)

NOMBRE_PARQUET = "envios_sinteticos.parquet"
NOMBRE_RESUMEN = "envios_resumen.json"


@dataclass(frozen=True)
class PerfilTransportadora:
    """Comportamiento sintético de una transportadora."""

    nombre: str
    participacion: float
    """Peso relativo en el volumen total."""
    afinidad_apartados: float
    """Multiplicador del peso cuando el destino es apartado."""
    horas_recogida: float
    """Media de horas entre la factura y el despacho."""
    mediana_factor: float
    """Mediana del tiempo de tránsito como fracción de la promesa de entrega."""
    sigma_factor: float
    """Dispersión (log-normal) del tiempo de tránsito: a mayor valor, menos predecible."""
    prob_devolucion: float
    factor_duplicados: float
    """Cuánto más probable es que sus guías lleguen con varios estados."""
    factor_tarifa: float = 1.0
    """Multiplicador de la tarifa por kg frente a la tarifa base del destino."""


@dataclass(frozen=True)
class TipoDestino:
    """Grupo de ciudades destino con la misma promesa de entrega."""

    nombre: str
    ciudades: tuple[str, ...]
    participacion: float
    dias_promesa: int
    prob_reexpedicion: float
    es_apartado: bool = False
    tarifa_kg: float = 1_000.0
    """Tarifa base del flete en pesos por kg."""


TRANSPORTADORAS: tuple[PerfilTransportadora, ...] = (
    # nombre, participación, afinidad apartados, h recogida, mediana, sigma, devolución,
    # duplicados, factor de tarifa
    PerfilTransportadora("Transportadora A", 0.22, 0.6, 10.0, 0.62, 0.28, 0.010, 1.0, 1.05),
    PerfilTransportadora("Transportadora B", 0.18, 0.8, 14.0, 0.68, 0.30, 0.015, 1.0, 1.00),
    PerfilTransportadora("Transportadora C", 0.16, 1.0, 18.0, 0.72, 0.34, 0.020, 1.0, 0.95),
    PerfilTransportadora("Transportadora D", 0.15, 1.0, 16.0, 0.78, 0.36, 0.025, 4.0, 0.90),
    PerfilTransportadora("Transportadora E", 0.11, 3.0, 24.0, 0.74, 0.40, 0.030, 1.0, 1.10),
    PerfilTransportadora("Transportadora F", 0.08, 4.0, 30.0, 0.84, 0.42, 0.040, 1.0, 1.30),
    PerfilTransportadora("Transportadora G", 0.10, 0.5, 8.0, 0.60, 0.32, 0.012, 1.0, 1.15),
)

ORIGENES: tuple[tuple[str, float], ...] = (
    ("Bogotá", 0.45),
    ("Medellín", 0.25),
    ("Cali", 0.18),
    ("Barranquilla", 0.12),
)
"""Centros de distribución (pocos orígenes) y su peso en el volumen."""

TIPOS_DESTINO: tuple[TipoDestino, ...] = (
    TipoDestino(
        nombre="principal",
        ciudades=(
            "Bogotá",
            "Medellín",
            "Cali",
            "Barranquilla",
            "Cartagena",
            "Bucaramanga",
            "Cúcuta",
            "Pereira",
        ),
        participacion=0.62,
        dias_promesa=2,
        prob_reexpedicion=0.0,
        tarifa_kg=950.0,
    ),
    TipoDestino(
        nombre="intermedia",
        ciudades=(
            "Ibagué",
            "Manizales",
            "Villavicencio",
            "Santa Marta",
            "Neiva",
            "Pasto",
            "Montería",
            "Armenia",
            "Popayán",
            "Valledupar",
            "Tunja",
            "Sincelejo",
        ),
        participacion=0.28,
        dias_promesa=3,
        prob_reexpedicion=0.03,
        tarifa_kg=1_500.0,
    ),
    TipoDestino(
        nombre="apartada",
        ciudades=(
            "Riohacha",
            "Yopal",
            "Florencia",
            "Quibdó",
            "Arauca",
            "Mocoa",
            "San Andrés",
            "San José del Guaviare",
            "Leticia",
            "Puerto Carreño",
            "Inírida",
            "Mitú",
        ),
        participacion=0.10,
        dias_promesa=6,
        prob_reexpedicion=0.70,
        es_apartado=True,
        tarifa_kg=3_800.0,
    ),
)

# Estacionalidad sintética: peso por mes (enero a diciembre) y por día (lunes a domingo).
PESO_MES = np.array([0.90, 0.95, 1.05, 1.00, 1.05, 1.00, 0.95, 1.00, 1.05, 1.10, 1.20, 1.15])
PESO_DIA_SEMANA = np.array([1.15, 1.10, 1.05, 1.05, 1.00, 0.45, 0.10])
CRECIMIENTO_PERIODO = 0.25
"""El último día del periodo pesa un 25 % más que el primero."""

HORA_APERTURA_MIN = 8 * 60
HORA_CIERRE_MIN = 19 * 60
MEDIA_HORAS_FACTURA = 6.0
PENALIDAD_REEXPEDICION = 1.20
"""Una reexpedición alarga el tránsito un 20 %: interviene una segunda transportadora."""

PESO_DUPLICADO_CON_NOVEDAD = 6.0
"""Los envíos con novedad o entrega tardía reportan más estados intermedios."""
PROB_FILAS_EXTRA = (0.7, 0.3)
"""Probabilidad de que una guía duplicada tenga 1 o 2 filas adicionales."""
PROB_ESPACIOS = (0.8, 0.2)
"""Probabilidad de que la llave sucia lleve 1 o 2 espacios al inicio."""

# Venta, flete y peso (pesos colombianos sintéticos).
MEDIANA_VENTA = 2_500_000
SIGMA_VENTA = 0.9
VENTA_MINIMA = 150_000
MEDIANA_VALOR_POR_KG = 300_000
"""Valor de la mercancía por kg: los medicamentos valen mucho por poco peso."""
SIGMA_VALOR_POR_KG = 0.5
PESO_MINIMO_KG = 0.5
FLETE_MINIMO = 7_000
"""Lo mínimo que cobra una transportadora por guía: castiga a las facturas pequeñas."""
SIGMA_FLETE = 0.15
RECARGO_REEXPEDICION = 0.35
META_FLETE_PCT = 1.0
"""Meta: el flete no debe superar el 1 % del valor de la venta que transporta."""
SEMILLA_VALORES = 1
"""Las columnas de valores usan su propio generador, con semilla ``[semilla, 1]``."""


@dataclass(frozen=True)
class Configuracion:
    """Parámetros de una corrida. Con la misma configuración la salida es idéntica."""

    semilla: int = 42
    envios: int = 20_000
    prop_guias_duplicadas: float = 0.12
    prop_filas_con_espacios: float = 0.03
    fecha_inicio: date = date(2025, 7, 1)
    fecha_corte: date = date(2026, 6, 30)

    def __post_init__(self) -> None:
        if self.envios < 1:
            raise ValueError("envios debe ser mayor que cero")
        if not 0 <= self.prop_guias_duplicadas <= 0.5:
            raise ValueError("prop_guias_duplicadas debe estar entre 0 y 0.5")
        if not 0 <= self.prop_filas_con_espacios <= 1:
            raise ValueError("prop_filas_con_espacios debe estar entre 0 y 1")
        if self.fecha_inicio >= self.fecha_corte:
            raise ValueError("fecha_inicio debe ser anterior a fecha_corte")

    @property
    def instante_corte(self) -> np.datetime64:
        """Último segundo del día de corte: lo posterior aún no ha ocurrido."""
        return (
            np.datetime64(self.fecha_corte, "s") + np.timedelta64(1, "D") - np.timedelta64(1, "s")
        )


# --------------------------------------------------------------------------- #
# Generación de envíos (una fila por guía, sin problemas de calidad)
# --------------------------------------------------------------------------- #


def _normalizar(pesos: Sequence[float] | np.ndarray) -> np.ndarray:
    """Convierte pesos relativos en probabilidades que suman 1."""
    arreglo = np.asarray(pesos, dtype=float)
    return arreglo / arreglo.sum()


def _por_transportadora(atributo: str, indices: np.ndarray) -> np.ndarray:
    """Devuelve, fila a fila, el atributo del perfil de la transportadora asignada."""
    return np.array([getattr(perfil, atributo) for perfil in TRANSPORTADORAS])[indices]


def _horas(valor: np.ndarray) -> np.ndarray:
    """Convierte horas decimales en un ``timedelta64`` redondeado al minuto."""
    return np.round(valor * 60).astype("int64").astype("timedelta64[m]")


def _generar_guias(rng: np.random.Generator, n: int) -> np.ndarray:
    """Guías únicas con formato ``GS`` + 9 dígitos, sin relación con numeraciones reales."""
    numeros = rng.choice(900_000_000, size=n, replace=False) + 100_000_000
    return np.char.add("GS", numeros.astype(str))


def _sortear_solicitudes(rng: np.random.Generator, cfg: Configuracion) -> np.ndarray:
    """Fecha y hora de solicitud, con estacionalidad mensual, semanal y horario de oficina."""
    dias = np.arange(
        np.datetime64(cfg.fecha_inicio, "D"),
        np.datetime64(cfg.fecha_corte, "D") + np.timedelta64(1, "D"),
    )
    mes = dias.astype("datetime64[M]").astype(int) % 12
    dia_semana = (dias.astype(int) + 3) % 7  # 1970-01-01 fue jueves; 0 = lunes
    tendencia = np.linspace(1.0, 1.0 + CRECIMIENTO_PERIODO, len(dias))
    pesos = PESO_MES[mes] * PESO_DIA_SEMANA[dia_semana] * tendencia

    dia = rng.choice(dias, size=cfg.envios, p=_normalizar(pesos))
    minuto = np.clip(rng.normal(11.5 * 60, 150, cfg.envios), 7 * 60, HORA_CIERRE_MIN)
    return dia.astype("datetime64[s]") + np.round(minuto).astype("int64").astype("timedelta64[m]")


def _sortear_destinos(rng: np.random.Generator, n: int) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve el índice del tipo de destino y la ciudad destino de cada envío.

    Dentro de cada tipo, las primeras ciudades de la lista reciben más volumen.
    """
    tipo = rng.choice(
        len(TIPOS_DESTINO), size=n, p=_normalizar([t.participacion for t in TIPOS_DESTINO])
    )
    ciudad = np.empty(n, dtype=object)
    for i, tipo_destino in enumerate(TIPOS_DESTINO):
        filas = tipo == i
        pesos = 1.0 / np.arange(1, len(tipo_destino.ciudades) + 1) ** 0.7
        ciudad[filas] = rng.choice(tipo_destino.ciudades, size=filas.sum(), p=_normalizar(pesos))
    return tipo, ciudad


def _asignar_transportadoras(rng: np.random.Generator, tipo: np.ndarray) -> np.ndarray:
    """Asigna transportadora según su participación y su afinidad con destinos apartados."""
    asignada = np.empty(len(tipo), dtype=np.int64)
    for i, tipo_destino in enumerate(TIPOS_DESTINO):
        filas = tipo == i
        pesos = [
            p.participacion * (p.afinidad_apartados if tipo_destino.es_apartado else 1.0)
            for p in TRANSPORTADORAS
        ]
        asignada[filas] = rng.choice(len(TRANSPORTADORAS), size=filas.sum(), p=_normalizar(pesos))
    return asignada


def _a_horario_habil(rng: np.random.Generator, instante: np.ndarray) -> np.ndarray:
    """Mueve hacia adelante los eventos que caen fuera de horario (nunca hacia atrás)."""
    dia = instante.astype("datetime64[D]")
    minuto = (instante - dia.astype("datetime64[s]")).astype("timedelta64[m]").astype("int64")
    tarde = minuto > HORA_CIERRE_MIN
    fuera = tarde | (minuto < HORA_APERTURA_MIN)
    reapertura = HORA_APERTURA_MIN + rng.integers(0, 180, size=len(instante))
    siguiente = dia + np.where(tarde, 1, 0).astype("timedelta64[D]")
    ajustado = siguiente.astype("datetime64[s]") + reapertura.astype("timedelta64[m]")
    return np.where(fuera, ajustado, instante)


def _linea_de_tiempo(
    rng: np.random.Generator,
    solicitud: np.ndarray,
    transportadora: np.ndarray,
    dias_promesa: np.ndarray,
    es_reexpedicion: np.ndarray,
) -> dict[str, np.ndarray]:
    """Calcula la línea de tiempo completa, como si todos los envíos ya hubieran terminado.

    Cada etapa se suma a la anterior, así que solicitud <= factura <= despacho <= entrega
    se cumple por construcción. La promesa (``fecha_entrega_estimada``) vence al final
    del día ``despacho + días de promesa del destino``.
    """
    n = len(solicitud)
    factura = _a_horario_habil(rng, solicitud + _horas(rng.gamma(2.0, MEDIA_HORAS_FACTURA / 2, n)))
    horas_recogida = _por_transportadora("horas_recogida", transportadora)
    despacho = _a_horario_habil(rng, factura + _horas(rng.gamma(2.0, horas_recogida / 2)))

    estimada = (
        (despacho.astype("datetime64[D]") + dias_promesa.astype("timedelta64[D]")).astype(
            "datetime64[s]"
        )
        + np.timedelta64(1, "D")
        - np.timedelta64(1, "m")
    )

    factor = rng.lognormal(
        np.log(_por_transportadora("mediana_factor", transportadora)),
        _por_transportadora("sigma_factor", transportadora),
    ) * np.where(es_reexpedicion, PENALIDAD_REEXPEDICION, 1.0)
    entrega = _a_horario_habil(rng, despacho + _horas(dias_promesa * 24 * factor))

    return {
        "fecha_factura": factura,
        "fecha_despacho": despacho,
        "fecha_entrega_estimada": estimada,
        "fecha_entrega": entrega,
    }


def _aplicar_corte(
    fechas: dict[str, np.ndarray], se_devuelve: np.ndarray, corte: np.datetime64
) -> pd.DataFrame:
    """Oculta lo que ocurre después del corte y deriva el estado de cada envío.

    Devuelve las fechas visibles, el ``estado`` y la marca interna ``_con_novedad``
    (entrega tardía, novedad abierta o devolución).
    """
    nat = np.datetime64("NaT", "s")
    facturado = fechas["fecha_factura"] <= corte
    despachado = fechas["fecha_despacho"] <= corte
    finalizado = fechas["fecha_entrega"] <= corte
    entregado = finalizado & ~se_devuelve
    devuelto = finalizado & se_devuelve
    vencido = despachado & (corte > fechas["fecha_entrega_estimada"])
    recien_despachado = despachado & (corte - fechas["fecha_despacho"] < np.timedelta64(24, "h"))

    estado = np.select(
        [~facturado, ~despachado, entregado, devuelto, vencido, recien_despachado],
        ["solicitado", "facturado", "entregado", "devuelto", "novedad", "despachado"],
        default="en_transito",
    )
    entrega = np.where(entregado, fechas["fecha_entrega"], nat)
    tardio = entregado & (fechas["fecha_entrega"] > fechas["fecha_entrega_estimada"])

    return pd.DataFrame(
        {
            "fecha_factura": np.where(facturado, fechas["fecha_factura"], nat),
            "fecha_despacho": np.where(despachado, fechas["fecha_despacho"], nat),
            "fecha_entrega_estimada": np.where(despachado, fechas["fecha_entrega_estimada"], nat),
            "fecha_entrega": entrega,
            "estado": estado,
            "_con_novedad": tardio | devuelto | (estado == "novedad"),
        }
    )


def _sortear_valores(
    rng: np.random.Generator,
    tipo: np.ndarray,
    transportadora: np.ndarray,
    es_reexpedicion: np.ndarray,
) -> dict[str, np.ndarray]:
    """Valor de venta, peso y flete de cada guía.

    El peso sale del valor de la venta y de un valor por kg aleatorio. El flete es
    peso por tarifa (según destino y transportadora), con un mínimo por guía, algo
    de ruido y un recargo si hay reexpedición. Así, las facturas pequeñas (por el
    flete mínimo) y los destinos apartados (por la tarifa) son los que más se pasan
    de la meta del 1 %.
    """
    n = len(tipo)
    venta = np.maximum(VENTA_MINIMA, rng.lognormal(np.log(MEDIANA_VENTA), SIGMA_VENTA, n))
    venta = np.round(venta, -2)
    valor_por_kg = rng.lognormal(np.log(MEDIANA_VALOR_POR_KG), SIGMA_VALOR_POR_KG, n)
    peso = np.maximum(PESO_MINIMO_KG, np.round(venta / valor_por_kg, 1))
    tarifa = np.array([t.tarifa_kg for t in TIPOS_DESTINO])[tipo] * _por_transportadora(
        "factor_tarifa", transportadora
    )
    flete = (
        np.maximum(FLETE_MINIMO, peso * tarifa)
        * rng.lognormal(0.0, SIGMA_FLETE, n)
        * np.where(es_reexpedicion, 1 + RECARGO_REEXPEDICION, 1.0)
    )
    return {"valor_venta": venta, "valor_flete": np.round(flete, -2), "peso_kg": peso}


def _generar_envios_limpios(rng: np.random.Generator, cfg: Configuracion) -> pd.DataFrame:
    """Una fila por guía, ya con estado al corte y columnas internas (prefijo ``_``)."""
    n = cfg.envios
    guia = _generar_guias(rng, n)
    solicitud = _sortear_solicitudes(rng, cfg)
    origen = rng.choice([c for c, _ in ORIGENES], size=n, p=_normalizar([p for _, p in ORIGENES]))
    tipo, destino = _sortear_destinos(rng, n)
    transportadora = _asignar_transportadoras(rng, tipo)

    prob_reexpedicion = np.array([t.prob_reexpedicion for t in TIPOS_DESTINO])[tipo]
    es_reexpedicion = rng.random(n) < prob_reexpedicion
    dias_promesa = np.array([t.dias_promesa for t in TIPOS_DESTINO])[tipo]

    fechas = _linea_de_tiempo(rng, solicitud, transportadora, dias_promesa, es_reexpedicion)
    se_devuelve = rng.random(n) < _por_transportadora("prob_devolucion", transportadora)
    al_corte = _aplicar_corte(fechas, se_devuelve, cfg.instante_corte)

    # Generador aparte: agregar estas columnas no cambia ninguna de las anteriores.
    rng_valores = np.random.default_rng([cfg.semilla, SEMILLA_VALORES])
    valores = _sortear_valores(rng_valores, tipo, transportadora, es_reexpedicion)
    # La venta y el peso se conocen al facturar y el flete al despachar; antes, NULL.
    facturado = al_corte["fecha_factura"].notna().to_numpy()
    despachado = al_corte["fecha_despacho"].notna().to_numpy()
    montos = pd.DataFrame(
        {
            "valor_venta": pd.array(
                np.where(facturado, valores["valor_venta"], np.nan), dtype="Int64"
            ),
            "valor_flete": pd.array(
                np.where(despachado, valores["valor_flete"], np.nan), dtype="Int64"
            ),
            "peso_kg": np.where(facturado, valores["peso_kg"], np.nan),
        }
    )

    base = pd.DataFrame(
        {
            "guia": guia,
            "transportadora": _por_transportadora("nombre", transportadora),
            "ciudad_origen": origen,
            "ciudad_destino": destino,
            "fecha_solicitud": solicitud,
            "es_reexpedicion": es_reexpedicion,
            "_factor_duplicados": _por_transportadora("factor_duplicados", transportadora),
        }
    )
    return pd.concat([base, al_corte, montos], axis=1)


# --------------------------------------------------------------------------- #
# Problemas de calidad sembrados
# --------------------------------------------------------------------------- #


def estados_previos(estado_final: str, con_novedad: bool) -> list[str]:
    """Estados por los que pasó un envío antes de llegar a ``estado_final``.

    >>> estados_previos("entregado", con_novedad=False)
    ['solicitado', 'facturado', 'despachado', 'en_transito']
    >>> estados_previos("facturado", con_novedad=False)
    ['solicitado']
    """
    previos = [e for e in ESTADOS if ORDEN_ESTADO[e] < ORDEN_ESTADO[estado_final]]
    excluidos = {"entregado"} if con_novedad else {"entregado", "novedad"}
    return [e for e in previos if e not in excluidos]


def sembrar_duplicados(
    rng: np.random.Generator, envios: pd.DataFrame, proporcion: float
) -> pd.DataFrame:
    """Añade filas con estados anteriores a ``round(proporcion * guías)`` guías.

    Imita lo que pasa al cruzar el envío con su historial de estados: la guía se
    repite una vez por estado y las fechas, que son atributos del envío, se copian
    en todas sus filas. La elección no es uniforme: pesan más los envíos con
    novedad y las transportadoras con ``factor_duplicados`` alto. Por eso contar
    filas en vez de guías sesga el OTD hacia abajo.
    """
    n_duplicadas = round(proporcion * len(envios))
    if n_duplicadas == 0:
        return envios

    elegible = (envios["estado"] != "solicitado").to_numpy()
    if n_duplicadas > elegible.sum():
        raise ValueError("No hay suficientes guías con estados previos para duplicar")

    pesos = (
        elegible
        * np.where(envios["_con_novedad"], PESO_DUPLICADO_CON_NOVEDAD, 1.0)
        * envios["_factor_duplicados"].to_numpy()
    )
    elegidas = rng.choice(len(envios), size=n_duplicadas, replace=False, p=_normalizar(pesos))
    filas_extra = rng.choice([1, 2], size=n_duplicadas, p=PROB_FILAS_EXTRA)

    posiciones: list[int] = []
    estados: list[str] = []
    for posicion, cantidad in zip(elegidas.tolist(), filas_extra.tolist(), strict=True):
        fila = envios.iloc[posicion]
        previos = estados_previos(fila["estado"], bool(fila["_con_novedad"]))[-cantidad:]
        posiciones.extend([posicion] * len(previos))
        estados.extend(previos)

    extra = envios.iloc[posiciones].assign(estado=estados)
    return pd.concat([envios, extra], ignore_index=True)


def sembrar_espacios(
    rng: np.random.Generator, envios: pd.DataFrame, proporcion: float
) -> pd.DataFrame:
    """Antepone 1 o 2 espacios a la llave ``guia`` en ``round(proporcion * filas)`` filas."""
    n_sucias = round(proporcion * len(envios))
    if n_sucias == 0:
        return envios

    filas = rng.choice(len(envios), size=n_sucias, replace=False)
    espacios = rng.choice([1, 2], size=n_sucias, p=PROB_ESPACIOS)
    guia = envios["guia"].to_numpy(dtype=object).copy()
    guia[filas] = [
        " " * k + guia[i] for i, k in zip(filas.tolist(), espacios.tolist(), strict=True)
    ]
    return envios.assign(guia=guia)


def generar_envios(cfg: Configuracion) -> pd.DataFrame:
    """Genera el dataset final: envíos sintéticos más los problemas de calidad sembrados."""
    rng = np.random.default_rng(cfg.semilla)
    envios = _generar_envios_limpios(rng, cfg)
    envios = sembrar_duplicados(rng, envios, cfg.prop_guias_duplicadas)
    envios = (
        envios.assign(_orden=envios["estado"].map(ORDEN_ESTADO))
        .sort_values(["fecha_solicitud", "guia", "_orden"], kind="stable")
        .reset_index(drop=True)
    )
    envios = sembrar_espacios(rng, envios, cfg.prop_filas_con_espacios)
    return envios.loc[:, list(COLUMNAS)]


# --------------------------------------------------------------------------- #
# Limpieza y agregados (lo mismo que hacen las consultas SQL de scripts/queries)
# --------------------------------------------------------------------------- #


def deduplicar(envios: pd.DataFrame) -> pd.DataFrame:
    """Limpia la llave y deja una fila por guía: la de su estado más avanzado."""
    return (
        envios.assign(guia=envios["guia"].str.strip(), _orden=envios["estado"].map(ORDEN_ESTADO))
        .sort_values(["guia", "_orden"], kind="stable")
        .drop_duplicates("guia", keep="last")
        .drop(columns="_orden")
        .reset_index(drop=True)
    )


def _horas_entre(inicio: pd.Series, fin: pd.Series) -> pd.Series:
    return (fin - inicio).dt.total_seconds() / 3600


def _otd_pct(envios: pd.DataFrame) -> pd.DataFrame:
    """Entregas, entregas a tiempo y OTD (%) por transportadora sobre las filas recibidas."""
    entregas = envios.loc[envios["fecha_entrega"].notna()]
    a_tiempo = entregas["fecha_entrega"] <= entregas["fecha_entrega_estimada"]
    resumen = a_tiempo.groupby(entregas["transportadora"]).agg(entregas="size", a_tiempo="sum")
    resumen["otd_pct"] = 100 * resumen["a_tiempo"] / resumen["entregas"]
    return resumen


def resumir_otd(envios: pd.DataFrame, unicos: pd.DataFrame) -> list[dict[str, Any]]:
    """OTD correcto (una fila por guía) frente al ingenuo (contando filas duplicadas)."""
    correcto = _otd_pct(unicos)
    ingenuo = _otd_pct(envios)
    entregados = unicos.loc[unicos["fecha_entrega"].notna()]
    dias_transito = (
        (_horas_entre(entregados["fecha_despacho"], entregados["fecha_entrega"]) / 24)
        .groupby(entregados["transportadora"])
        .mean()
    )

    tabla = correcto.assign(
        otd_ingenuo_pct=ingenuo["otd_pct"],
        diferencia_pp=ingenuo["otd_pct"] - correcto["otd_pct"],
        dias_transito_promedio=dias_transito,
        ranking=correcto["otd_pct"].rank(method="min", ascending=False).astype(int),
    ).sort_values(["ranking", "transportadora"])

    return [
        {
            "transportadora": nombre,
            "ranking": int(fila.ranking),
            "entregas": int(fila.entregas),
            "entregas_a_tiempo": int(fila.a_tiempo),
            "otd_pct": round(fila.otd_pct, 2),
            "otd_ingenuo_pct": round(fila.otd_ingenuo_pct, 2),
            "diferencia_pp": round(fila.diferencia_pp, 2),
            "dias_transito_promedio": round(fila.dias_transito_promedio, 2),
        }
        for nombre, fila in zip(tabla.index, tabla.itertuples(), strict=True)
    ]


ETAPAS: tuple[tuple[str, str, str], ...] = (
    ("solicitud_a_factura", "fecha_solicitud", "fecha_factura"),
    ("factura_a_despacho", "fecha_factura", "fecha_despacho"),
    ("despacho_a_entrega", "fecha_despacho", "fecha_entrega"),
)


def resumir_etapas(unicos: pd.DataFrame) -> dict[str, Any]:
    """Horas promedio de cada etapa, en general y por transportadora."""
    horas = pd.DataFrame(
        {etapa: _horas_entre(unicos[inicio], unicos[fin]) for etapa, inicio, fin in ETAPAS}
    )
    por_transportadora = horas.groupby(unicos["transportadora"]).mean().round(1)
    return {
        "general": [
            {"etapa": etapa, "horas_promedio": round(float(horas[etapa].mean()), 1)}
            for etapa, _, _ in ETAPAS
        ],
        "por_transportadora": [
            {"transportadora": nombre, **{etapa: float(fila[etapa]) for etapa, _, _ in ETAPAS}}
            for nombre, fila in por_transportadora.iterrows()
        ],
    }


def resumir_volumen_mensual(unicos: pd.DataFrame) -> list[dict[str, Any]]:
    """Envíos solicitados por mes y OTD de los que ya se entregaron."""
    mes = unicos["fecha_solicitud"].dt.strftime("%Y-%m").rename("mes")
    entregado = unicos["fecha_entrega"].notna()
    a_tiempo = unicos["fecha_entrega"] <= unicos["fecha_entrega_estimada"]
    tabla = pd.DataFrame({"envios": 1, "entregados": entregado, "a_tiempo": a_tiempo})
    tabla = tabla.groupby(mes).sum()
    return [
        {
            "mes": nombre,
            "envios": int(fila.envios),
            "entregados": int(fila.entregados),
            "otd_pct": round(100 * fila.a_tiempo / fila.entregados, 2) if fila.entregados else None,
        }
        for nombre, fila in zip(tabla.index, tabla.itertuples(), strict=True)
    ]


def resumir_reexpediciones(unicos: pd.DataFrame, top: int = 10) -> dict[str, Any]:
    """Total de reexpediciones y los destinos donde más se concentran."""
    por_destino = (
        unicos.groupby("ciudad_destino")["es_reexpedicion"]
        .agg(envios="size", reexpediciones="sum")
        .sort_values(["reexpediciones", "envios"], ascending=False, kind="stable")
        .head(top)
    )
    total = int(unicos["es_reexpedicion"].sum())
    return {
        "total": total,
        "pct_sobre_envios": round(100 * total / len(unicos), 2),
        "por_destino": [
            {
                "ciudad_destino": ciudad,
                "envios": int(fila.envios),
                "reexpediciones": int(fila.reexpediciones),
                "pct": round(100 * fila.reexpediciones / fila.envios, 2),
            }
            for ciudad, fila in zip(por_destino.index, por_destino.itertuples(), strict=True)
        ],
    }


TIPO_POR_CIUDAD: dict[str, str] = {
    ciudad: tipo.nombre for tipo in TIPOS_DESTINO for ciudad in tipo.ciudades
}


def _flete_por_grupo(despachados: pd.DataFrame, grupo: pd.Series | None) -> pd.DataFrame:
    """Guías, guías en rojo, % flete/venta y pesos sobre la meta, por grupo."""
    tope = despachados["valor_venta"] * META_FLETE_PCT / 100
    en_rojo = despachados["valor_flete"] > tope
    tabla = pd.DataFrame(
        {
            "guias": 1,
            "guias_en_rojo": en_rojo,
            "flete": despachados["valor_flete"],
            "venta": despachados["valor_venta"],
            "exceso": (despachados["valor_flete"] - tope).where(en_rojo, 0),
        }
    ).astype(float)
    sumas = tabla.groupby(grupo).sum() if grupo is not None else tabla.sum().to_frame().T
    return sumas.assign(
        pct_en_rojo=100 * sumas["guias_en_rojo"] / sumas["guias"],
        flete_pct_venta=100 * sumas["flete"] / sumas["venta"],
    )


def resumir_flete(unicos: pd.DataFrame) -> dict[str, Any]:
    """Semáforo de flete vs venta (meta 1 %) y costo del flete por kg según destino.

    Cuenta solo las guías despachadas, que son las que ya tienen flete.
    """
    despachados = unicos.loc[unicos["valor_flete"].notna()]

    def fila(nombre: str | None, datos: pd.Series) -> dict[str, Any]:
        resultado: dict[str, Any] = {"transportadora": nombre} if nombre else {}
        return resultado | {
            "guias": int(datos["guias"]),
            "guias_en_rojo": int(datos["guias_en_rojo"]),
            "pct_en_rojo": round(float(datos["pct_en_rojo"]), 2),
            "flete_pct_venta": round(float(datos["flete_pct_venta"]), 2),
            "pesos_sobre_la_meta": round(float(datos["exceso"])),
        }

    general = _flete_por_grupo(despachados, None).iloc[0]
    por_transportadora = _flete_por_grupo(despachados, despachados["transportadora"])
    por_transportadora = por_transportadora.sort_values("pct_en_rojo", ascending=False)

    tipo = despachados["ciudad_destino"].map(TIPO_POR_CIUDAD).rename("tipo_destino")
    por_kg = (
        despachados.assign(tipo_destino=tipo)
        .groupby(["tipo_destino", "transportadora"])
        .agg(guias=("guia", "size"), flete=("valor_flete", "sum"), peso=("peso_kg", "sum"))
    )
    orden_tipos = [t.nombre for t in TIPOS_DESTINO]
    return {
        "meta_pct": META_FLETE_PCT,
        "general": fila(None, general),
        "por_transportadora": [
            fila(str(nombre), datos) for nombre, datos in por_transportadora.iterrows()
        ],
        "costo_kg_por_destino": [
            {
                "tipo_destino": tipo_destino,
                "transportadora": nombre,
                "guias": int(datos["guias"]),
                "costo_kg": round(float(datos["flete"] / datos["peso"])),
            }
            for (tipo_destino, nombre), datos in sorted(
                por_kg.iterrows(), key=lambda par: (orden_tipos.index(par[0][0]), par[0][1])
            )
        ],
    }


def resumir_rutas(
    unicos: pd.DataFrame, top: int = 10, min_entregas: int = 20
) -> list[dict[str, Any]]:
    """Días de despacho a entrega por ruta y transportadora, en rutas compartidas.

    Solo cuentan las transportadoras con al menos ``min_entregas`` entregas en la
    ruta, y solo las rutas que atienden dos o más: así la comparación es entre
    quienes van al mismo lugar. Devuelve las ``top`` rutas con más entregas.
    Es lo mismo que calcula ``scripts/queries/07_transportadoras_misma_ruta.sql``.
    """
    entregados = unicos.loc[unicos["fecha_entrega"].notna()]
    dias = _horas_entre(entregados["fecha_despacho"], entregados["fecha_entrega"]) / 24
    ruta = (entregados["ciudad_origen"] + " → " + entregados["ciudad_destino"]).rename("ruta")
    tabla = (
        pd.DataFrame({"ruta": ruta, "transportadora": entregados["transportadora"], "dias": dias})
        .groupby(["ruta", "transportadora"])["dias"]
        .agg(entregas="size", dias_promedio="mean")
        .reset_index()
    )
    tabla = tabla.loc[tabla["entregas"] >= min_entregas]
    por_ruta = tabla.groupby("ruta").agg(
        transportadoras=("transportadora", "size"), entregas=("entregas", "sum")
    )
    elegidas = (
        por_ruta.loc[por_ruta["transportadoras"] >= 2]
        .sort_values(["entregas"], ascending=False, kind="stable")
        .head(top)
        .index
    )

    resultado = []
    for nombre in elegidas:
        filas = tabla.loc[tabla["ruta"] == nombre].sort_values(["dias_promedio", "transportadora"])
        origen, destino = nombre.split(" → ")
        resultado.append(
            {
                "ruta": nombre,
                "origen": origen,
                "destino": destino,
                "entregas": int(filas["entregas"].sum()),
                "transportadoras": [
                    {
                        "transportadora": f.transportadora,
                        "entregas": int(f.entregas),
                        "dias_promedio": round(float(f.dias_promedio), 2),
                        "puesto": int(puesto),
                    }
                    for f, puesto in zip(
                        filas.itertuples(),
                        filas["dias_promedio"].round(2).rank(method="min").tolist(),
                        strict=True,
                    )
                ],
            }
        )
    return resultado


def resumir_calidad(envios: pd.DataFrame, cfg: Configuracion) -> dict[str, Any]:
    """Cuenta exacta de los problemas sembrados, para poder verificarlos en SQL."""
    limpia = envios["guia"].str.strip()
    filas_por_guia = limpia.value_counts()
    return {
        "prop_guias_duplicadas": cfg.prop_guias_duplicadas,
        "guias_duplicadas": int((filas_por_guia > 1).sum()),
        "filas_sobrantes": int(len(envios) - filas_por_guia.size),
        "prop_filas_con_espacios": cfg.prop_filas_con_espacios,
        "filas_con_espacios": int((envios["guia"] != limpia).sum()),
        "guias_distintas_sin_limpiar": int(envios["guia"].nunique()),
    }


def construir_resumen(envios: pd.DataFrame, cfg: Configuracion) -> dict[str, Any]:
    """Arma el JSON de agregados. No incluye la fecha real de ejecución: es determinista."""
    unicos = deduplicar(envios)
    estados = unicos["estado"].value_counts()
    return {
        "metadatos": {
            "descripcion": "Datos 100 % sintéticos. No representan cifras de ninguna empresa.",
            "generador": "scripts/generate_sample_data.py",
            "semilla": cfg.semilla,
            "filas": len(envios),
            "guias_unicas": len(unicos),
            "periodo": {
                "desde": cfg.fecha_inicio.isoformat(),
                "hasta": cfg.fecha_corte.isoformat(),
            },
            "fecha_generacion": cfg.fecha_corte.isoformat(),
        },
        "calidad_sembrada": resumir_calidad(envios, cfg),
        "estados": {estado: int(estados.get(estado, 0)) for estado in ESTADOS},
        "otd_por_transportadora": resumir_otd(envios, unicos),
        "tiempo_promedio_por_etapa": resumir_etapas(unicos),
        "volumen_por_mes": resumir_volumen_mensual(unicos),
        "reexpediciones": resumir_reexpediciones(unicos),
        "tiempos_por_ruta": resumir_rutas(unicos),
        "flete_vs_venta": resumir_flete(unicos),
    }


# --------------------------------------------------------------------------- #
# Salidas y línea de comandos
# --------------------------------------------------------------------------- #


def escribir_parquet(envios: pd.DataFrame, ruta: Path) -> None:
    """Escribe el Parquet con esquema explícito y sin metadatos de pandas.

    Timestamps en milisegundos sin zona horaria (DuckDB los lee como ``TIMESTAMP``)
    y compresión ZSTD, que DuckDB-WASM soporta y deja el archivo liviano. El
    diccionario solo se usa en las columnas de pocos valores distintos: en las
    llaves y las fechas ocupa más de lo que ahorra.
    """
    tabla = pa.Table.from_pandas(envios, schema=ESQUEMA_PARQUET, preserve_index=False)
    pq.write_table(
        tabla.replace_schema_metadata(None),
        ruta,
        compression="zstd",
        compression_level=19,
        use_dictionary=list(COLUMNAS_CATEGORICAS),
        store_schema=False,
    )


def escribir_resumen(resumen: dict[str, Any], ruta: Path) -> None:
    texto = json.dumps(resumen, ensure_ascii=False, indent=2) + "\n"
    ruta.write_text(texto, encoding="utf-8", newline="\n")


def leer_argumentos(argv: Sequence[str] | None = None) -> argparse.Namespace:
    predeterminada = Configuracion()
    parser = argparse.ArgumentParser(
        description="Genera envíos sintéticos (Parquet) y un resumen agregado (JSON)."
    )
    parser.add_argument("--seed", type=int, default=predeterminada.semilla, help="semilla")
    parser.add_argument(
        "--envios",
        "--rows",
        dest="envios",
        type=int,
        default=predeterminada.envios,
        help="número de envíos (guías únicas); las filas son más por los duplicados sembrados",
    )
    parser.add_argument(
        "--prop-duplicadas",
        type=float,
        default=predeterminada.prop_guias_duplicadas,
        help="proporción de guías que aparecen en varias filas (una por estado)",
    )
    parser.add_argument(
        "--prop-espacios",
        type=float,
        default=predeterminada.prop_filas_con_espacios,
        help="proporción de filas cuya guía lleva espacios al inicio",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public" / "data",
        help="directorio de salida (por defecto, public/data)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = leer_argumentos(argv)
    cfg = Configuracion(
        semilla=args.seed,
        envios=args.envios,
        prop_guias_duplicadas=args.prop_duplicadas,
        prop_filas_con_espacios=args.prop_espacios,
    )
    envios = generar_envios(cfg)
    resumen = construir_resumen(envios, cfg)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    ruta_parquet = args.output_dir / NOMBRE_PARQUET
    ruta_resumen = args.output_dir / NOMBRE_RESUMEN
    escribir_parquet(envios, ruta_parquet)
    escribir_resumen(resumen, ruta_resumen)

    calidad = resumen["calidad_sembrada"]
    print(f"{ruta_parquet}: {len(envios):,} filas, {ruta_parquet.stat().st_size / 1024:.0f} KiB")
    print(f"{ruta_resumen}: {resumen['metadatos']['guias_unicas']:,} guías únicas")
    print(
        f"Sembrado: {calidad['guias_duplicadas']:,} guías duplicadas, "
        f"{calidad['filas_con_espacios']:,} filas con espacios en la llave"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
