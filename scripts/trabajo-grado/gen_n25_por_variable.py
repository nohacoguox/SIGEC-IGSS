"""Genera tabulados n=25 por variable (ilustrativos) con reglas Palín–DAF."""
from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path

BASE = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\PRIMERA ENTREGA\punto3_POR_VARIABLE")


def add_bd(start: date, days: int) -> date:
    d, left = start, days
    while left > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d


def nwd(a: date, b: date) -> int:
    n, d = 0, a
    while d <= b:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def send(y, m, day):
    day = max(16, min(22, day))
    d = date(y, m, day)
    guard = 0
    while d.weekday() >= 5 and guard < 10:
        guard += 1
        if d.day < 22:
            d += timedelta(days=1)
        else:
            d -= timedelta(days=1)
        if d.day < 16:
            d = date(y, m, 16)
        if d.day > 22:
            d = date(y, m, 20)
            while d.weekday() >= 5:
                d -= timedelta(days=1)
    return d


def next_send(y, m, preferred=18):
    if m == 12:
        return send(y + 1, 1, preferred)
    return send(y, m + 1, preferred)


# 25 casos: tipología mezclada; servicios con más obs; algunos pasan de mes
# id, siaf, exp, tipo, y, m, day_env, off, dan, t1, obs, rech, cic, pasa, nota
RAW = [
    (1, "Insumos", 2025, 1, 17, 9, 2, "Observacion", 1, 0, 1, False, "Observacion menor; mismo mes"),
    (2, "Servicio", 2025, 1, 20, 11, 3, "Observacion", 3, 0, 1, False, "Servicio: justificacion SIAF"),
    (3, "Activo fijo", 2025, 1, 22, 14, 3, "Aprobacion", 0, 0, 0, False, "Aprobado primer analisis"),
    (4, "Servicio", 2025, 2, 18, 10, 3, "Observacion", 4, 1, 2, True, "Servicio; paso a marzo"),
    (5, "Insumos", 2025, 2, 19, 8, 2, "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (6, "Insumos", 2025, 2, 21, 12, 2, "Observacion", 2, 0, 1, False, "Falta anexo; mismo mes"),
    (7, "Servicio", 2025, 3, 17, 9, 3, "Observacion", 3, 0, 1, False, "Servicio: forma de justificar"),
    (8, "Activo fijo", 2025, 3, 20, 13, 3, "Observacion", 2, 0, 1, False, "Especificacion incompleta"),
    (9, "Servicio", 2025, 3, 21, 11, 3, "Rechazo", 4, 1, 2, True, "Rechazo; reingreso abril"),
    (10, "Insumos", 2025, 4, 16, 7, 2, "Aprobacion", 0, 0, 0, False, "Sin devoluciones"),
    (11, "Servicio", 2025, 4, 18, 10, 3, "Observacion", 3, 0, 1, False, "Descripcion SIAF ajustada"),
    (12, "Insumos", 2025, 4, 22, 12, 2, "Observacion", 1, 0, 1, False, "Cotizacion; mismo mes"),
    (13, "Servicio", 2025, 5, 19, 11, 3, "Rechazo", 5, 1, 2, True, "Mala produccion a junio"),
    (14, "Activo fijo", 2025, 5, 20, 9, 2, "Aprobacion", 0, 0, 0, False, "Aprobado primer analisis"),
    (15, "Insumos", 2025, 5, 21, 8, 3, "Observacion", 2, 0, 1, False, "Correccion menor"),
    (16, "Servicio", 2025, 6, 17, 10, 3, "Observacion", 3, 0, 1, False, "Justificacion reelaborada"),
    (17, "Insumos", 2025, 6, 18, 6, 2, "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (18, "Servicio", 2025, 6, 20, 12, 3, "Observacion", 4, 0, 2, True, "Paso a julio"),
    (19, "Insumos", 2025, 7, 16, 8, 2, "Observacion", 1, 0, 1, False, "Anexo; mismo mes"),
    (20, "Servicio", 2025, 7, 18, 10, 3, "Observacion", 3, 0, 1, False, "Servicio: redaccion objetada"),
    (21, "Activo fijo", 2025, 7, 21, 9, 2, "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (22, "Insumos", 2025, 8, 19, 7, 3, "Observacion", 2, 0, 1, False, "Soporte incompleto"),
    (23, "Servicio", 2025, 8, 20, 11, 3, "Rechazo", 4, 1, 2, True, "Servicio; paso a septiembre"),
    (24, "Insumos", 2025, 8, 22, 10, 2, "Aprobacion", 0, 0, 0, False, "Sin devoluciones"),
    (25, "Servicio", 2025, 9, 17, 9, 3, "Observacion", 3, 0, 1, False, "Servicio: ajuste justificacion"),
]


def build():
    rows = []
    for i, tipo, y, m, d_env, off, dan, t1, obs, rech, cic, pasa, nota in RAW:
        idc = f"LB-{i:02d}"
        siaf = f"SIAF-{i:02d}-2025"
        exp = f"EXP-{i:02d}-2025"
        puesta = send(y, m, d_env)
        inicio = puesta - timedelta(days=off)
        while inicio.weekday() >= 5:
            inicio -= timedelta(days=1)
        primera = add_bd(puesta, dan)
        if t1 == "Aprobacion":
            aprob, dev = primera, "No"
        elif pasa:
            # prefer weekday in 16-22 next month
            ree = next_send(y, m, 20)
            aprob, dev = add_bd(ree, dan), "Sí"
        else:
            corr = 4 if tipo == "Servicio" else 3
            aprob, dev = add_bd(primera, corr + max(0, cic - 1) * 2), "Sí"
        assert 16 <= puesta.day <= 22, (idc, puesta)
        t1c = t2c = t3c = t5c = "Sí"
        t4 = "Sí" if cic == 0 else "No"
        if pasa:
            t4 = "No"
        t6 = "No"
        t7 = "No" if cic >= 1 or pasa else "Sí"
        cumple = "Sí" if all(x == "Sí" for x in (t1c, t2c, t3c, t4, t5c)) else "No"
        mins = 3 + (0 if cic == 0 else 5) + (3 if tipo == "Servicio" else 0) + (4 if pasa else 0) + obs
        motivo = {
            "Aprobacion": "N/A",
            "Observacion": "Redaccion/justificacion SIAF" if tipo == "Servicio" else "Documento/anexo",
            "Rechazo": "No se corrigio a tiempo / descripcion no conforme",
        }[t1]
        rows.append(
            dict(
                id=idc,
                siaf=siaf,
                exp=exp,
                tipo=tipo,
                inicio=inicio,
                puesta=puesta,
                primera=primera,
                t1=t1,
                aprob=aprob,
                dc=nwd(inicio, aprob),
                dr=dan,
                obs=obs,
                rech=rech,
                dev=dev,
                cic=cic,
                pasa="Sí" if pasa else "No",
                nota=nota,
                t1c=t1c,
                t2c=t2c,
                t3c=t3c,
                t4=t4,
                t5c=t5c,
                t6=t6,
                t7=t7,
                cumple=cumple,
                mins=mins,
                motivo=motivo,
            )
        )
    return rows


def avg(xs):
    return sum(xs) / len(xs) if xs else 0


def main():
    rows = build()
    n = len(rows)
    assert n == 25
    ind = {
        "n": n,
        "ciclos": avg([r["cic"] for r in rows]),
        "pct_dev": sum(r["dev"] == "Sí" for r in rows) / n * 100,
        "pasan": sum(r["pasa"] == "Sí" for r in rows),
        "obs": avg([r["obs"] for r in rows]),
        "rech100": sum(r["rech"] for r in rows) / n * 100,
        "obs_s": avg([r["obs"] for r in rows if r["tipo"] == "Servicio"]),
        "obs_o": avg([r["obs"] for r in rows if r["tipo"] != "Servicio"]),
        "pct_traz": sum(r["cumple"] == "Sí" for r in rows) / n * 100,
        "mins": avg([r["mins"] for r in rows]),
        "ciclo": avg([r["dc"] for r in rows]),
        "resp": avg([r["dr"] for r in rows]),
        "periodo": f"{min(r['inicio'] for r in rows).strftime('%d/%m/%Y')} – {max(r['aprob'] for r in rows).strftime('%d/%m/%Y')}",
    }

    # empty templates 25 rows
    for path, header in [
        (
            BASE / "V1_Eficiencia" / "instrumento_vacio.csv",
            "ID_caso,Numero_SIAF,Numero_Expediente,Tipo_tramite,N_ciclos_revision_correccion_reenvio,Devuelto_al_menos_1_vez,Paso_al_mes_siguiente,Fuente_datos,Observaciones_registro",
        ),
        (
            BASE / "V2_Calidad" / "instrumento_vacio.csv",
            "ID_caso,Numero_SIAF,Numero_Expediente,Tipo_tramite,N_observaciones,N_rechazos_formales,Motivo_principal_observacion_o_rechazo,Fuente_datos,Observaciones_registro",
        ),
        (
            BASE / "V3_Trazabilidad" / "instrumento_vacio.csv",
            "ID_caso,T1_Identificacion_clara,T2_Fecha_inicio_documentada,T3_Responsable_o_area,T4_Historial_devoluciones_reconstruible,T5_Estado_final_DAF_claro,T6_Versiones_distinguibles,T7_Fecha_cambios_localizable,Cumple_global_T1_a_T5,Minutos_localizar_ultima_version_y_estado,Observaciones",
        ),
        (
            BASE / "V4_Tiempos" / "instrumento_vacio.csv",
            "ID_caso,Numero_SIAF,Numero_Expediente,Tipo_tramite,Fecha_inicio,Fecha_puesta_revision_DAF,Fecha_primera_resolucion_DAF,Fecha_aprobacion_DAF,Dias_habiles_ciclo_total,Dias_habiles_primera_respuesta_DAF,Fuente_datos,Observaciones_registro",
        ),
    ]:
        cols = header.split(",")
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for i in range(1, 26):
                row = [f"LB-{i:02d}"] + [""] * (len(cols) - 1)
                w.writerow(row)

    # V1 filled
    with (BASE / "V1_Eficiencia" / "tabulado_lleno.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ID_caso",
                "Numero_SIAF",
                "Numero_Expediente",
                "Tipo_tramite",
                "N_ciclos_revision_correccion_reenvio",
                "Devuelto_al_menos_1_vez",
                "Paso_al_mes_siguiente",
                "Fuente_datos",
                "Observaciones_registro",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    r["siaf"],
                    r["exp"],
                    r["tipo"],
                    r["cic"],
                    r["dev"],
                    r["pasa"],
                    "Expediente fisico + planilla Compras",
                    r["nota"],
                ]
            )

    with (BASE / "V2_Calidad" / "tabulado_lleno.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ID_caso",
                "Numero_SIAF",
                "Numero_Expediente",
                "Tipo_tramite",
                "N_observaciones",
                "N_rechazos_formales",
                "Motivo_principal_observacion_o_rechazo",
                "Fuente_datos",
                "Observaciones_registro",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    r["siaf"],
                    r["exp"],
                    r["tipo"],
                    r["obs"],
                    r["rech"],
                    r["motivo"],
                    "Expediente fisico",
                    r["nota"],
                ]
            )

    with (BASE / "V3_Trazabilidad" / "tabulado_lleno.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ID_caso",
                "T1_Identificacion_clara",
                "T2_Fecha_inicio_documentada",
                "T3_Responsable_o_area",
                "T4_Historial_devoluciones_reconstruible",
                "T5_Estado_final_DAF_claro",
                "T6_Versiones_distinguibles",
                "T7_Fecha_cambios_localizable",
                "Cumple_global_T1_a_T5",
                "Minutos_localizar_ultima_version_y_estado",
                "Observaciones",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    r["t1c"],
                    r["t2c"],
                    r["t3c"],
                    r["t4"],
                    r["t5c"],
                    r["t6"],
                    r["t7"],
                    r["cumple"],
                    r["mins"],
                    r["nota"],
                ]
            )

    with (BASE / "V4_Tiempos" / "tabulado_lleno.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ID_caso",
                "Numero_SIAF",
                "Numero_Expediente",
                "Tipo_tramite",
                "Fecha_inicio",
                "Fecha_puesta_revision_DAF",
                "Fecha_primera_resolucion_DAF",
                "Fecha_aprobacion_DAF",
                "Dias_habiles_ciclo_total",
                "Dias_habiles_primera_respuesta_DAF",
                "Fuente_datos",
                "Observaciones_registro",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    r["siaf"],
                    r["exp"],
                    r["tipo"],
                    r["inicio"].strftime("%d/%m/%Y"),
                    r["puesta"].strftime("%d/%m/%Y"),
                    r["primera"].strftime("%d/%m/%Y"),
                    r["aprob"].strftime("%d/%m/%Y"),
                    r["dc"],
                    r["dr"],
                    "Expediente fisico (envio 16-22)",
                    r["nota"],
                ]
            )

    # update summaries and key docs
    (BASE / "V1_Eficiencia" / "resumen_indicadores.md").write_text(
        f"""# V1 — Eficiencia (n = {n})

| Indicador | Valor |
|-----------|------:|
| Promedio ciclos | {ind['ciclos']:.2f} |
| % devueltos >=1 | {ind['pct_dev']:.2f}% |
| Casos que pasaron al mes siguiente | {ind['pasan']} |
""",
        encoding="utf-8",
    )
    (BASE / "V2_Calidad" / "resumen_indicadores.md").write_text(
        f"""# V2 — Calidad (n = {n})

| Indicador | Valor |
|-----------|------:|
| Promedio observaciones | {ind['obs']:.2f} |
| Rechazos / 100 | {ind['rech100']:.2f} |
| Obs. Servicio | {ind['obs_s']:.2f} |
| Obs. otros | {ind['obs_o']:.2f} |
""",
        encoding="utf-8",
    )
    (BASE / "V3_Trazabilidad" / "resumen_indicadores.md").write_text(
        f"""# V3 — Trazabilidad (n = {n})

| Indicador | Valor |
|-----------|------:|
| % criterio global T1-T5 | {ind['pct_traz']:.2f}% |
| Minutos promedio busqueda | {ind['mins']:.2f} |
""",
        encoding="utf-8",
    )
    (BASE / "V4_Tiempos" / "resumen_indicadores.md").write_text(
        f"""# V4 — Tiempos (n = {n})

| Indicador | Valor |
|-----------|------:|
| Ciclo total medio (dias habiles) | {ind['ciclo']:.2f} |
| 1a respuesta DAF media | {ind['resp']:.2f} |
| Casos que pasaron al mes siguiente | {ind['pasan']} |
| Periodo ejemplo | {ind['periodo']} |
""",
        encoding="utf-8",
    )

    meta_dev = ind["pct_dev"] - 30
    meta_obs = ind["obs"] * 0.6
    meta_ciclo = ind["ciclo"] * 0.75

    (BASE / "00_MAPA_GENERAL.md").write_text(
        f"""# Reestructuracion por variable — muestra fija

## Muestra
- **n = 25 expedientes** (muestra general acordada para la linea base).
- Misma muestra para V1, V2, V3 y V4.
- Reglas: envio fisico 16-22; DAF analiza 2-3 dias habiles; servicios con mas observaciones; si no corrigen a tiempo pasa al mes siguiente.

## Instrumentos
| Variable | Instrumento | Anexo |
|----------|-------------|-------|
| V1 Eficiencia | Ficha ciclos/devoluciones | Anexo A: V1_Eficiencia |
| V2 Calidad | Ficha observaciones/rechazos | Anexo B: V2_Calidad |
| V3 Trazabilidad | Lista de cotejo | Anexo C: V3_Trazabilidad |
| V4 Tiempos | Ficha de hitos | Anexo D: V4_Tiempos |

Los tabulados llenos son **ilustrativos**. Sustituye por tus 25 SIAF/expedientes reales.
""",
        encoding="utf-8",
    )

    (BASE / "01_TEXTO_PARA_TESIS.md").write_text(
        f"""# Texto para tesis (n = 25)

## Muestra
Poblacion de referencia del area de Compras: cinco analistas con carga operativa de expedientes. Para la medicion inicial de linea base se adopto una **muestra de n = 25** SIAF/expedientes del Consultorio de Palin en interaccion con la DAF departamental de Escuintla, aplicados a los cuatro instrumentos (V1–V4) sobre los mismos casos.

Periodo ejemplo (ilustrativo): {ind['periodo']}.

## Resultados linea base

### V1 Eficiencia
| Indicador | Valor |
|-----------|------:|
| Promedio ciclos | {ind['ciclos']:.2f} |
| % devueltos >=1 | {ind['pct_dev']:.2f}% |

### V2 Calidad
| Indicador | Valor |
|-----------|------:|
| Promedio observaciones | {ind['obs']:.2f} |
| Rechazos / 100 | {ind['rech100']:.2f} |
| Obs. Servicio | {ind['obs_s']:.2f} |
| Obs. otros | {ind['obs_o']:.2f} |

### V3 Trazabilidad
| Indicador | Valor |
|-----------|------:|
| % trazabilidad global | {ind['pct_traz']:.2f}% |
| Minutos busqueda | {ind['mins']:.2f} |

### V4 Tiempos
| Indicador | Valor |
|-----------|------:|
| Ciclo total medio (dias habiles) | {ind['ciclo']:.2f} |
| 1a respuesta DAF | {ind['resp']:.2f} |
| Pasaron al mes siguiente | {ind['pasan']} de 25 |
""",
        encoding="utf-8",
    )

    (BASE / "02_HIPOTESIS_MEDIBLE.md").write_text(
        f"""# Hipotesis medible (n = 25 linea base ilustrativa)

## Hipotesis propuesta

La implementacion del SIGEC-IGSS en el Consultorio de Palin mejora el desempeno del flujo SIAF/expediente frente a la linea base (n = 25), de modo que en un periodo comparable del piloto:
(a) el porcentaje de expedientes devueltos al menos una vez se reduce en al menos 30 puntos porcentuales respecto de {ind['pct_dev']:.2f}%;
(b) el promedio de observaciones por expediente se reduce en al menos 40% respecto de {ind['obs']:.2f};
(c) el tiempo medio del ciclo total en dias habiles se reduce en al menos 25% respecto de {ind['ciclo']:.2f}; y
(d) el porcentaje de expedientes con criterio global de trazabilidad se incrementa hasta al menos 80% (linea base {ind['pct_traz']:.2f}%).

## Metas numericas de referencia

| Indicador | Linea base | Meta piloto |
|-----------|------------|-------------|
| % devueltos >=1 | {ind['pct_dev']:.2f}% | <= {meta_dev:.2f}% |
| Obs. promedio | {ind['obs']:.2f} | <= {meta_obs:.2f} |
| Ciclo total (dias habiles) | {ind['ciclo']:.2f} | <= {meta_ciclo:.2f} |
| % trazabilidad | {ind['pct_traz']:.2f}% | >= 80% |

Si reemplazas los 25 casos por datos reales, recalcula linea base y ajusta metas.
""",
        encoding="utf-8",
    )

    print("OK n=", n)
    for k, v in ind.items():
        print(f"{k}={v}")


if __name__ == "__main__":
    main()
