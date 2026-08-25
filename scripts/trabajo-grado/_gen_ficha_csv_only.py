from __future__ import annotations
import csv, sys
from datetime import date, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
OUT = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\scripts\punto3_EJEMPLO_COMPLETO")
OUT.mkdir(parents=True, exist_ok=True)

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
    while d.weekday() >= 5:
        d += timedelta(days=1) if d.day < 22 else timedelta(days=-1)
    return d

def next_send(y, m, day=18):
    return send(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, day)

RAW = [
    ("LB-01","SIAF-03-2025","EXP-01-2025","Insumos",2025,1,17,9,2,"Observacion",1,0,1,False,"Observacion menor; Palin corrigio en el mismo ciclo mensual"),
    ("LB-02","SIAF-05-2025","EXP-02-2025","Servicio",2025,1,20,11,3,"Observacion",3,0,1,False,"Servicio: justificacion del SIAF no coincidia con criterio DAF; se corrigio redaccion"),
    ("LB-03","SIAF-07-2025","EXP-03-2025","Activo fijo",2025,1,22,14,3,"Aprobacion",0,0,0,False,"Aprobado en primer analisis del expediente fisico"),
    ("LB-04","SIAF-09-2025","EXP-04-2025","Servicio",2025,2,18,10,3,"Observacion",4,1,2,True,"Servicio: multiples correcciones; no se subsano a tiempo y quedo para marzo"),
    ("LB-05","SIAF-11-2025","EXP-05-2025","Insumos",2025,2,19,8,2,"Aprobacion",0,0,0,False,"Sin observaciones en primer analisis"),
    ("LB-06","SIAF-14-2025","EXP-06-2025","Insumos",2025,2,21,12,2,"Observacion",2,0,1,False,"Faltaba anexo; corregido en el mismo mes"),
    ("LB-07","SIAF-16-2025","EXP-07-2025","Servicio",2025,3,17,9,3,"Observacion",3,0,1,False,"Servicio: forma de justificar el gasto objetada; se reescribio SIAF"),
    ("LB-08","SIAF-18-2025","EXP-08-2025","Activo fijo",2025,3,20,13,3,"Observacion",2,0,1,False,"Especificacion tecnica incompleta; corregida antes del cierre mensual"),
    ("LB-09","SIAF-21-2025","EXP-09-2025","Servicio",2025,3,21,11,3,"Rechazo",4,1,2,True,"Servicio: correcciones no aplicadas a tiempo; rechazo y reingreso en abril"),
    ("LB-10","SIAF-23-2025","EXP-10-2025","Insumos",2025,4,16,7,2,"Aprobacion",0,0,0,False,"Aprobado sin devoluciones"),
    ("LB-11","SIAF-25-2025","EXP-11-2025","Servicio",2025,4,18,10,3,"Observacion",3,0,1,False,"Servicio: descripcion del SIAF ajustada segun criterio DAF"),
    ("LB-12","SIAF-28-2025","EXP-12-2025","Insumos",2025,4,22,12,2,"Observacion",1,0,1,False,"Observacion por cotizacion; subsanada en el mes"),
    ("LB-13","SIAF-30-2025","EXP-13-2025","Servicio",2025,5,19,11,3,"Rechazo",5,1,2,True,"Servicio: mala produccion por rechazo; pendiente junio"),
    ("LB-14","SIAF-32-2025","EXP-14-2025","Activo fijo",2025,5,20,9,2,"Aprobacion",0,0,0,False,"Aprobado en primer analisis"),
    ("LB-15","SIAF-35-2025","EXP-15-2025","Insumos",2025,5,21,8,3,"Observacion",2,0,1,False,"Correccion documental menor en el mismo ciclo"),
    ("LB-16","SIAF-37-2025","EXP-16-2025","Servicio",2025,6,17,10,3,"Observacion",3,0,1,False,"Servicio: justificacion reelaborada por criterio de redaccion DAF"),
    ("LB-17","SIAF-40-2025","EXP-17-2025","Insumos",2025,6,18,6,2,"Aprobacion",0,0,0,False,"Sin observaciones"),
    ("LB-18","SIAF-42-2025","EXP-18-2025","Servicio",2025,6,20,12,3,"Observacion",4,0,2,True,"Servicio: varias vueltas de redaccion; paso a julio"),
]

rows = []
for idc,siaf,exp,tipo,y,m,d_env,off,dan,t1res,obs,rech,cic,pasa,nota in RAW:
    puesta = send(y,m,d_env)
    inicio = puesta - timedelta(days=off)
    while inicio.weekday() >= 5:
        inicio -= timedelta(days=1)
    primera = add_bd(puesta, dan)
    if t1res == "Aprobacion":
        aprob, dev = primera, "No"
    elif pasa:
        ree = next_send(y, m, 21 if cic >= 2 else 18)
        aprob, dev = add_bd(ree, dan), "Sí"
    else:
        corr = 4 if tipo == "Servicio" else 3
        aprob, dev = add_bd(primera, corr + max(0, cic-1)*2), "Sí"
    assert 16 <= puesta.day <= 22
    rows.append(dict(
        id=idc,siaf=siaf,exp=exp,tipo=tipo,inicio=inicio,puesta=puesta,primera=primera,
        t1res=t1res,aprob=aprob,dc=nwd(inicio,aprob),dr=dan,obs=obs,rech=rech,dev=dev,cic=cic,
        fuente="Expediente fisico + planilla Compras Palin (envio mensual 16-22)", nota=nota, pasa=pasa
    ))

hdr = ["ID_caso","Numero_SIAF","Numero_Expediente","Tipo_tramite","Fecha_inicio","Fecha_puesta_revision_DAF","Fecha_primera_resolucion_DAF","Tipo_primera_resolucion","Fecha_aprobacion_DAF","Dias_habiles_ciclo_total","Dias_habiles_primera_respuesta_DAF","N_observaciones","N_rechazos_formales","Devuelto_al_menos_1_vez","N_ciclos_revision_correccion_reenvio","Fuente_datos","Observaciones_registro"]
with (OUT/"03_Ficha_LLENA.csv").open("w",encoding="utf-8-sig",newline="") as f:
    w=csv.writer(f); w.writerow(hdr)
    for r in rows:
        w.writerow([r["id"],r["siaf"],r["exp"],r["tipo"],r["inicio"].strftime("%d/%m/%Y"),r["puesta"].strftime("%d/%m/%Y"),r["primera"].strftime("%d/%m/%Y"),r["t1res"],r["aprob"].strftime("%d/%m/%Y"),r["dc"],r["dr"],r["obs"],r["rech"],r["dev"],r["cic"],r["fuente"],r["nota"]])

n=len(rows)
def avg(xs): return sum(xs)/len(xs)
inds=dict(
    n=n,
    ciclo=avg([r["dc"] for r in rows]),
    resp=avg([r["dr"] for r in rows]),
    ciclos=avg([r["cic"] for r in rows]),
    pct_dev=sum(r["dev"]=="Sí" for r in rows)/n*100,
    obs=avg([r["obs"] for r in rows]),
    rech100=sum(r["rech"] for r in rows)/n*100,
    pasan=sum(r["pasa"] for r in rows),
    obs_s=avg([r["obs"] for r in rows if r["tipo"]=="Servicio"]),
    obs_o=avg([r["obs"] for r in rows if r["tipo"]!="Servicio"]),
)
print("WROTE", OUT/"03_Ficha_LLENA.csv")
for k,v in inds.items():
    print(f"{k}={v}")
for r in rows:
    print(f"{r['id']}|{r['tipo']}|ini={r['inicio']}|puesta={r['puesta']}|1ra={r['primera']}|aprob={r['aprob']}|dc={r['dc']}|dr={r['dr']}|obs={r['obs']}|dev={r['dev']}|pasa={r['pasa']}")
