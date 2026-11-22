"""Pruebas del generador: reproducibilidad, coherencia de fechas y problemas sembrados."""

from __future__ import annotations

import hashlib
import itertools
import json
from pathlib import Path

import pandas as pd
import pytest

import generate_sample_data as gsd

CFG = gsd.Configuracion(semilla=123, envios=3_000)
FECHAS_EN_ORDEN = ["fecha_solicitud", "fecha_factura", "fecha_despacho", "fecha_entrega"]
DIR_CONSULTAS = Path(gsd.__file__).resolve().parent / "queries"


@pytest.fixture(scope="module")
def envios() -> pd.DataFrame:
    return gsd.generar_envios(CFG)


@pytest.fixture(scope="module")
def unicos(envios: pd.DataFrame) -> pd.DataFrame:
    return gsd.deduplicar(envios)


def _huellas(directorio: Path) -> dict[str, str]:
    return {
        ruta.name: hashlib.sha256(ruta.read_bytes()).hexdigest()
        for ruta in sorted(directorio.iterdir())
    }


# ------------------------------ Reproducibilidad ------------------------------ #


def test_misma_semilla_mismo_dataframe(envios: pd.DataFrame) -> None:
    pd.testing.assert_frame_equal(envios, gsd.generar_envios(CFG))


def test_otra_semilla_cambia_los_datos(envios: pd.DataFrame) -> None:
    otros = gsd.generar_envios(gsd.Configuracion(semilla=124, envios=CFG.envios))
    assert not envios["guia"].equals(otros["guia"])


def test_archivos_identicos_byte_a_byte(tmp_path: Path) -> None:
    argumentos = ["--seed", "7", "--envios", "1500"]
    for corrida in ("a", "b"):
        assert gsd.main([*argumentos, "--output-dir", str(tmp_path / corrida)]) == 0

    huellas = _huellas(tmp_path / "a")
    assert set(huellas) == {gsd.NOMBRE_PARQUET, gsd.NOMBRE_RESUMEN}
    assert huellas == _huellas(tmp_path / "b")


# ----------------------------- Esquema y dominio ------------------------------ #


def test_columnas_y_valores_del_dominio(envios: pd.DataFrame) -> None:
    assert tuple(envios.columns) == gsd.COLUMNAS
    assert set(envios["transportadora"]) == {f"Transportadora {letra}" for letra in "ABCDEFG"}
    assert set(envios["estado"]) <= set(gsd.ESTADOS)
    assert set(envios["ciudad_origen"]) <= {ciudad for ciudad, _ in gsd.ORIGENES}
    assert envios["es_reexpedicion"].dtype == bool


def test_parquet_conserva_tipos_y_nulos(envios: pd.DataFrame, tmp_path: Path) -> None:
    ruta = tmp_path / "envios.parquet"
    gsd.escribir_parquet(envios, ruta)
    leido = pd.read_parquet(ruta)

    assert len(leido) == len(envios)
    assert leido["guia"].tolist() == envios["guia"].tolist()
    for columna in FECHAS_EN_ORDEN:
        assert leido[columna].isna().sum() == envios[columna].isna().sum()


# ---------------------------- Coherencia de fechas ---------------------------- #


def test_fechas_en_orden_cronologico(envios: pd.DataFrame) -> None:
    for anterior, siguiente in itertools.pairwise(FECHAS_EN_ORDEN):
        ambas = envios[[anterior, siguiente]].dropna()
        assert (ambas[anterior] <= ambas[siguiente]).all(), f"{anterior} > {siguiente}"


def test_una_etapa_no_ocurre_sin_la_anterior(envios: pd.DataFrame) -> None:
    for anterior, siguiente in itertools.pairwise(FECHAS_EN_ORDEN):
        assert envios.loc[envios[anterior].isna(), siguiente].isna().all()
    # La promesa de entrega existe exactamente cuando hay despacho.
    assert (envios["fecha_entrega_estimada"].isna() == envios["fecha_despacho"].isna()).all()
    assert (envios["fecha_entrega_estimada"].dropna() > envios["fecha_despacho"].dropna()).all()


def test_nada_ocurre_fuera_del_periodo(envios: pd.DataFrame) -> None:
    corte = pd.Timestamp(CFG.instante_corte)
    assert envios["fecha_solicitud"].min() >= pd.Timestamp(CFG.fecha_inicio)
    for columna in FECHAS_EN_ORDEN:
        assert envios[columna].max() <= corte


def test_estado_final_coherente_con_las_fechas(unicos: pd.DataFrame) -> None:
    entregado = unicos["estado"] == "entregado"
    assert (unicos["fecha_entrega"].notna() == entregado).all()
    assert unicos.loc[unicos["estado"] == "solicitado", "fecha_factura"].isna().all()
    assert unicos.loc[unicos["estado"] == "facturado", "fecha_despacho"].isna().all()
    en_ruta = unicos["estado"].isin(["despachado", "en_transito", "novedad", "devuelto"])
    assert unicos.loc[en_ruta, "fecha_despacho"].notna().all()


# ---------------------------- Problemas sembrados ----------------------------- #


def test_proporcion_exacta_de_guias_duplicadas(envios: pd.DataFrame) -> None:
    filas_por_guia = envios["guia"].str.strip().value_counts()

    assert filas_por_guia.size == CFG.envios
    assert (filas_por_guia > 1).sum() == round(CFG.prop_guias_duplicadas * CFG.envios)
    assert filas_por_guia.max() <= 3


def test_duplicados_solo_difieren_en_el_estado(envios: pd.DataFrame) -> None:
    limpio = envios.assign(guia=envios["guia"].str.strip())
    sin_estado = limpio.drop(columns="estado").drop_duplicates()
    assert len(sin_estado) == CFG.envios
    assert not limpio.duplicated(["guia", "estado"]).any()


def test_proporcion_exacta_de_llaves_con_espacios(envios: pd.DataFrame) -> None:
    con_espacios = envios["guia"] != envios["guia"].str.strip()

    assert con_espacios.sum() == round(CFG.prop_filas_con_espacios * len(envios))
    assert envios.loc[con_espacios, "guia"].str.startswith(" ").all()
    assert not envios["guia"].str.endswith(" ").any()


def test_sin_problemas_si_las_proporciones_son_cero() -> None:
    cfg = gsd.Configuracion(
        semilla=1, envios=1_000, prop_guias_duplicadas=0, prop_filas_con_espacios=0
    )
    limpios = gsd.generar_envios(cfg)

    assert len(limpios) == cfg.envios
    assert limpios["guia"].is_unique
    assert (limpios["guia"] == limpios["guia"].str.strip()).all()


def test_contar_duplicados_subestima_el_otd(envios: pd.DataFrame) -> None:
    resumen = gsd.construir_resumen(envios, CFG)
    diferencias = [fila["diferencia_pp"] for fila in resumen["otd_por_transportadora"]]

    assert all(diferencia <= 0 for diferencia in diferencias)
    assert min(diferencias) < -2


def test_configuracion_rechaza_valores_invalidos() -> None:
    with pytest.raises(ValueError, match="envios"):
        gsd.Configuracion(envios=0)
    with pytest.raises(ValueError, match="prop_guias_duplicadas"):
        gsd.Configuracion(prop_guias_duplicadas=0.9)


# ------------------------------ Consultas SQL --------------------------------- #


@pytest.fixture(scope="module")
def conexion(envios: pd.DataFrame, tmp_path_factory: pytest.TempPathFactory):
    duckdb = pytest.importorskip("duckdb")
    ruta = tmp_path_factory.mktemp("datos") / gsd.NOMBRE_PARQUET
    gsd.escribir_parquet(envios, ruta)
    con = duckdb.connect()
    con.execute(f"CREATE VIEW envios AS SELECT * FROM read_parquet('{ruta.as_posix()}')")
    yield con
    con.close()


@pytest.mark.parametrize("consulta", sorted(DIR_CONSULTAS.glob("*.sql")), ids=lambda p: p.stem)
def test_las_consultas_corren_y_devuelven_filas(conexion, consulta: Path) -> None:
    filas = conexion.execute(consulta.read_text(encoding="utf-8")).fetchall()
    assert filas


def test_otd_en_sql_coincide_con_el_resumen(conexion, envios: pd.DataFrame) -> None:
    sql = (DIR_CONSULTAS / "06_error_por_duplicados.sql").read_text(encoding="utf-8")
    en_sql = conexion.execute(sql).df().set_index("transportadora")
    resumen = json.loads(json.dumps(gsd.construir_resumen(envios, CFG)))

    for fila in resumen["otd_por_transportadora"]:
        calculado = en_sql.loc[fila["transportadora"]]
        assert calculado["guias_entregadas"] == fila["entregas"]
        assert calculado["otd_correcto_pct"] == pytest.approx(fila["otd_pct"], abs=0.011)
        assert calculado["otd_ingenuo_pct"] == pytest.approx(fila["otd_ingenuo_pct"], abs=0.011)
