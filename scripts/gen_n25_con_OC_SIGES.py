"""Actualiza instrumentos: Numero_Expediente -> Numero_Orden_Compra (SIGES)."""
from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

BASE = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\PRIMERA ENTREGA\punto3_POR_VARIABLE")
ALT = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\scripts\punto3_n25_MarMay2026")
random.seed(20260321)


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
    while d.weekday() >= 5 and guard < 12:
        guard += 1
        if 16 <= d.day < 22:
            d += timedelta(days=1)
        else:
            d -= timedelta(days=1)
        if d.month != m:
            d = date(y, m, 20)
            while d.weekday() >= 5:
                d -= timedelta(days=1)
            break
    return d


def next_send(y, m, preferred=18):
    if m == 12:
        return send(y + 1, 1, preferred)
    return send(y, m + 1, preferred)


SPEC = [
    (3, 17, 8, 2, "Insumos", "Observacion", 1, 0, 1, False, "Observacion menor; mismo mes"),
    (3, 18, 10, 3, "Servicio", "Observacion", 3, 0, 1, False, "Servicio: justificacion SIAF"),
    (3, 19, 7, 2, "Activo fijo", "Aprobacion", 0, 0, 0, False, "Aprobado primer analisis"),
    (3, 20, 11, 3, "Servicio", "Observacion", 4, 1, 2, True, "Servicio; paso a abril"),
    (3, 21, 9, 3, "Insumos", "Observacion", 2, 0, 1, False, "Falta anexo; mismo mes"),
    (3, 17, 12, 2, "Servicio", "Observacion", 3, 0, 1, False, "Servicio: redaccion objetada"),
    (3, 22, 8, 3, "Insumos", "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (3, 18, 6, 2, "Activo fijo", "Observacion", 2, 0, 1, False, "Especificacion incompleta"),
    (4, 16, 9, 2, "Insumos", "Aprobacion", 0, 0, 0, False, "Sin devoluciones"),
    (4, 17, 11, 3, "Servicio", "Observacion", 3, 0, 1, False, "Descripcion SIAF ajustada"),
    (4, 20, 10, 3, "Servicio", "Rechazo", 4, 1, 2, True, "Rechazo; reingreso en mayo"),
    (4, 21, 7, 2, "Insumos", "Observacion", 1, 0, 1, False, "Cotizacion; mismo mes"),
    (4, 18, 8, 3, "Activo fijo", "Aprobacion", 0, 0, 0, False, "Aprobado primer analisis"),
    (4, 22, 12, 2, "Insumos", "Observacion", 2, 0, 1, False, "Soporte incompleto"),
    (4, 16, 9, 3, "Servicio", "Observacion", 3, 0, 1, False, "Justificacion reelaborada"),
    (4, 19, 6, 2, "Insumos", "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (5, 18, 10, 3, "Servicio", "Observacion", 4, 0, 2, True, "Varias vueltas; paso a junio"),
    (5, 19, 8, 2, "Insumos", "Observacion", 1, 0, 1, False, "Anexo; mismo mes"),
    (5, 20, 11, 3, "Servicio", "Observacion", 3, 0, 1, False, "Servicio: ajuste justificacion"),
    (5, 21, 7, 2, "Activo fijo", "Aprobacion", 0, 0, 0, False, "Sin observaciones"),
    (5, 16, 9, 3, "Insumos", "Observacion", 2, 0, 1, False, "Documento de soporte"),
    (5, 22, 10, 3, "Servicio", "Rechazo", 5, 1, 2, True, "Mala produccion; pendiente junio"),
    (5, 17, 6, 2, "Insumos", "Aprobacion", 0, 0, 0, False, "Sin devoluciones"),
    (5, 18, 12, 3, "Servicio", "Observacion", 3, 0, 1, False, "Palabras/descripcion SIAF"),
    (5, 20, 8, 2, "Insumos", "Observacion", 1, 0, 1, False, "Correccion menor; mismo mes"),
]


def unique_nums(n, low, high):
    pool = list(range(low, high + 1))
    random.shuffle(pool)
    return pool[:n]


def write_csv(path: Path, header, data_rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    targets = [path, path.with_name(path.stem + "_OC.csv")]
    if path.is_relative_to(BASE):
        rel = path.relative_to(BASE)
        targets.append(ALT / rel)
    written = []
    for t in targets:
        try:
            t.parent.mkdir(parents=True, exist_ok=True)
            with t.open("w", encoding="utf-8-sig", newline="") as f:
                w = csv.writer(f)
                w.writerow(header)
                w.writerows(data_rows)
            written.append(str(t))
        except PermissionError:
            alt = t.with_name(t.stem + "_nuevo.csv")
            with alt.open("w", encoding="utf-8-sig", newline="") as f:
                w = csv.writer(f)
                w.writerow(header)
                w.writerows(data_rows)
            written.append(str(alt) + " (alt)")
    return written


def main():
    # SIAF: 2-3 digits style like operational refs; OC: 6-digit like SIGES example 219713
    siaf_nums = unique_nums(25, 14, 96)
    oc_nums = unique_nums(25, 210450, 229880)
    # ensure no accidental same last digits pattern
    for i in range(25):
        while str(siaf_nums[i]) in str(oc_nums[i]):
            oc_nums[i] = random.randint(210450, 229880)

    rows = []
    y = 2026
    for idx, (m, d_env, off, dan, tipo, t1, obs, rech, cic, pasa, nota) in enumerate(SPEC):
        puesta = send(y, m, d_env)
        inicio = puesta - timedelta(days=off)
        while inicio.weekday() >= 5:
            inicio -= timedelta(days=1)
        primera = add_bd(puesta, dan)
        if t1 == "Aprobacion":
            aprob, dev = primera, "No"
        elif pasa:
            ree = next_send(y, m, 20)
            aprob, dev = add_bd(ree, dan), "Sí"
        else:
            corr = 4 if tipo == "Servicio" else 3
            aprob, dev = add_bd(primera, corr + max(0, cic - 1) * 2), "Sí"

        t1c = t2c = t3c = t5c = "Sí"
        t4 = "No" if cic >= 1 or pasa else "Sí"
        t6, t7 = "No", ("No" if cic >= 1 or pasa else "Sí")
        cumple = "Sí" if all(x == "Sí" for x in (t1c, t2c, t3c, t4, t5c)) else "No"
        mins = 3 + (0 if cic == 0 else 5) + (3 if tipo == "Servicio" else 0) + (4 if pasa else 0) + obs
        motivo = {
            "Aprobacion": "N/A",
            "Observacion": "Redaccion/justificacion SIAF" if tipo == "Servicio" else "Documento/anexo",
            "Rechazo": "No se corrigio a tiempo / descripcion no conforme",
        }[t1]
        rows.append(
            dict(
                siaf=f"SIAF-{siaf_nums[idx]}-2026",
                oc=str(oc_nums[idx]),
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

    random.shuffle(rows)
    for i, r in enumerate(rows, 1):
        r["id"] = f"LB-{i:02d}"

    # empty templates
    empty25 = [[f"LB-{i:02d}"] + [""] * 8 for i in range(1, 26)]
    write_csv(
        BASE / "V1_Eficiencia" / "instrumento_vacio.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "N_ciclos_revision_correccion_reenvio",
            "Devuelto_al_menos_1_vez",
            "Paso_al_mes_siguiente",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [[f"LB-{i:02d}"] + [""] * 8 for i in range(1, 26)],
    )
    write_csv(
        BASE / "V2_Calidad" / "instrumento_vacio.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "N_observaciones",
            "N_rechazos_formales",
            "Motivo_principal_observacion_o_rechazo",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [[f"LB-{i:02d}"] + [""] * 8 for i in range(1, 26)],
    )
    write_csv(
        BASE / "V4_Tiempos" / "instrumento_vacio.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "Fecha_inicio",
            "Fecha_puesta_revision_DAF",
            "Fecha_primera_resolucion_DAF",
            "Fecha_aprobacion_DAF",
            "Dias_habiles_ciclo_total",
            "Dias_habiles_primera_respuesta_DAF",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [[f"LB-{i:02d}"] + [""] * 11 for i in range(1, 26)],
    )
    # V3 has no expediente column - leave as is but rewrite empty for consistency
    write_csv(
        BASE / "V3_Trazabilidad" / "instrumento_vacio.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
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
        ],
        [[f"LB-{i:02d}"] + [""] * 12 for i in range(1, 26)],
    )

    write_csv(
        BASE / "V1_Eficiencia" / "tabulado_lleno.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "N_ciclos_revision_correccion_reenvio",
            "Devuelto_al_menos_1_vez",
            "Paso_al_mes_siguiente",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [
            [
                r["id"],
                r["siaf"],
                r["oc"],
                r["tipo"],
                r["cic"],
                r["dev"],
                r["pasa"],
                "OC SIGES + planilla Compras (muestra Mar-May 2026)",
                r["nota"],
            ]
            for r in rows
        ],
    )
    write_csv(
        BASE / "V2_Calidad" / "tabulado_lleno.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "N_observaciones",
            "N_rechazos_formales",
            "Motivo_principal_observacion_o_rechazo",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [
            [
                r["id"],
                r["siaf"],
                r["oc"],
                r["tipo"],
                r["obs"],
                r["rech"],
                r["motivo"],
                "OC SIGES + expediente fisico (muestra Mar-May 2026)",
                r["nota"],
            ]
            for r in rows
        ],
    )
    write_csv(
        BASE / "V3_Trazabilidad" / "tabulado_lleno.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
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
        ],
        [
            [
                r["id"],
                r["siaf"],
                r["oc"],
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
            for r in rows
        ],
    )
    write_csv(
        BASE / "V4_Tiempos" / "tabulado_lleno.csv",
        [
            "ID_caso",
            "Numero_SIAF",
            "Numero_Orden_Compra_SIGES",
            "Tipo_tramite",
            "Fecha_inicio",
            "Fecha_puesta_revision_DAF",
            "Fecha_primera_resolucion_DAF",
            "Fecha_aprobacion_DAF",
            "Dias_habiles_ciclo_total",
            "Dias_habiles_primera_respuesta_DAF",
            "Fuente_datos",
            "Observaciones_registro",
        ],
        [
            [
                r["id"],
                r["siaf"],
                r["oc"],
                r["tipo"],
                r["inicio"].strftime("%d/%m/%Y"),
                r["puesta"].strftime("%d/%m/%Y"),
                r["primera"].strftime("%d/%m/%Y"),
                r["aprob"].strftime("%d/%m/%Y"),
                r["dc"],
                r["dr"],
                "OC SIGES (envio fisico 16-22; muestra Mar-May 2026)",
                r["nota"],
            ]
            for r in rows
        ],
    )

    note = """# Identificador operativo

En el IGSS (unidad piloto) los tramites **no** se identifican por un "numero de expediente" interno,
sino por la **Orden de Compra (O.C.)** generada en la plataforma **SIGES**,
independientemente de la modalidad (baja cuantia, evento, compra directa, etc.).

Por ello, en los instrumentos V1–V4 la columna es:

**Numero_Orden_Compra_SIGES**

(Ejemplo real de formato: O.C. 219713 en Orden de Compra SIGES).

SIAF y Orden de Compra son numeros **distintos e independientes**.
"""
    (BASE / "NOTA_ORDEN_COMPRA_SIGES.md").write_text(note, encoding="utf-8")
    try:
        (BASE / "00_MAPA_GENERAL.md").write_text(
            "# Muestra\n\n- n=25 | Mar-Abr-May 2026\n- Identificador: **Orden de Compra SIGES** (no numero de expediente)\n- SIAF aleatorio e independiente de la O.C.\n",
            encoding="utf-8",
        )
    except PermissionError:
        pass

    print("OK ejemplos:")
    for r in rows[:6]:
        print(r["id"], r["siaf"], "OC", r["oc"])


if __name__ == "__main__":
    main()
