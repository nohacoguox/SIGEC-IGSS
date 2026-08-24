# -*- coding: utf-8 -*-
"""Genera el modelo entidad–relación completo de SIGEC-IGSS en partes (PNG)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "diagramas_er"
OUT.mkdir(parents=True, exist_ok=True)

# Paleta institucional
BG = (248, 250, 252)
HEADER = (24, 58, 90)
HEADER_TXT = (255, 255, 255)
BOX = (255, 255, 255)
BORDER = (40, 70, 100)
ATTR = (45, 55, 72)
LINE = (70, 90, 110)
ACCENT = (30, 100, 140)
JOIN = (90, 60, 120)
NOTE = (100, 110, 120)


def font(size: int, bold: bool = False):
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_TITLE = font(18, True)
F_ENTITY = font(13, True)
F_ATTR = font(11)
F_SMALL = font(10)
F_CARD = font(10, True)
F_BANNER = font(16, True)


class EntityBox:
    def __init__(self, name: str, attrs: list[str], x: int, y: int, w: int = 210):
        self.name = name
        self.attrs = attrs
        self.x = x
        self.y = y
        self.w = w
        self.h_header = 28
        self.row_h = 18
        self.h = self.h_header + 8 + len(attrs) * self.row_h + 8

    @property
    def cx(self):
        return self.x + self.w // 2

    @property
    def cy(self):
        return self.y + self.h // 2

    def edge(self, toward_x: float, toward_y: float):
        """Punto en el borde del rectángulo hacia un punto externo."""
        cx, cy = self.cx, self.cy
        dx, dy = toward_x - cx, toward_y - cy
        if dx == 0 and dy == 0:
            return cx, cy
        # Intersección con rectángulo
        hw, hh = self.w / 2, self.h / 2
        sx = hw / abs(dx) if dx else float("inf")
        sy = hh / abs(dy) if dy else float("inf")
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s


def new_canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    return img, draw


def draw_banner(draw, text: str, w: int, y: int = 16):
    draw.rounded_rectangle((24, y, w - 24, y + 40), radius=8, fill=HEADER)
    draw.text((40, y + 10), text, fill=HEADER_TXT, font=F_BANNER)
    return y + 56


def draw_entity(draw, box: EntityBox, join: bool = False):
    border = JOIN if join else BORDER
    draw.rounded_rectangle(
        (box.x, box.y, box.x + box.w, box.y + box.h),
        radius=6,
        fill=BOX,
        outline=border,
        width=2,
    )
    draw.rounded_rectangle(
        (box.x, box.y, box.x + box.w, box.y + box.h_header),
        radius=6,
        fill=JOIN if join else HEADER,
    )
    # square bottom of header
    draw.rectangle(
        (box.x, box.y + 12, box.x + box.w, box.y + box.h_header),
        fill=JOIN if join else HEADER,
    )
    tw = draw.textlength(box.name, font=F_ENTITY)
    draw.text((box.x + (box.w - tw) / 2, box.y + 6), box.name, fill=HEADER_TXT, font=F_ENTITY)
    yy = box.y + box.h_header + 6
    for attr in box.attrs:
        draw.text((box.x + 10, yy), attr, fill=ATTR, font=F_ATTR)
        yy += box.row_h


def draw_link(draw, a: EntityBox, b: EntityBox, label: str, dashed: bool = False):
    x1, y1 = a.edge(b.cx, b.cy)
    x2, y2 = b.edge(a.cx, a.cy)
    if dashed:
        # simple dashed
        import math

        length = math.hypot(x2 - x1, y2 - y1) or 1
        segs = max(int(length / 10), 1)
        for i in range(0, segs, 2):
            t0, t1 = i / segs, min((i + 1) / segs, 1)
            draw.line(
                (x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1),
                fill=LINE,
                width=2,
            )
    else:
        draw.line((x1, y1, x2, y2), fill=LINE, width=2)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    lw = draw.textlength(label, font=F_CARD)
    pad = 4
    draw.rounded_rectangle(
        (mx - lw / 2 - pad, my - 9, mx + lw / 2 + pad, my + 9),
        radius=4,
        fill=(236, 242, 248),
        outline=ACCENT,
    )
    draw.text((mx - lw / 2, my - 7), label, fill=ACCENT, font=F_CARD)


def draw_footer(draw, w: int, h: int, text: str):
    draw.text((28, h - 28), text, fill=NOTE, font=F_SMALL)


# ─── Parte A: Vista de módulos ───────────────────────────────────────────────

def parte_a_mapa():
    w, h = 1400, 900
    img, draw = new_canvas(w, h)
    y0 = draw_banner(draw, "SIGEC-IGSS — Modelo entidad–relación completo (mapa de módulos)", w)

    modules = [
        ("Seguridad y acceso", ["USUARIO", "CREDENCIAL", "ROL", "PERMISO", "user_roles", "role_permissions"], 60, y0 + 40),
        ("Estructura organizacional", ["DEPARTAMENTO", "MUNICIPIO", "UNIDAD_MEDICA", "PUESTO", "AREA"], 480, y0 + 40),
        ("Módulo SIAF", ["SIAF_SOLICITUD", "SIAF_ITEM", "SIAF_SUBPRODUCTO", "SIAF_AUTORIZACION", "SIAF_BITACORA", "SIAF_DOC_ADJUNTO"], 900, y0 + 40),
        ("Módulo Expedientes", ["EXPEDIENTE", "EXP_DOCUMENTO", "EXP_VERSION", "EXP_BITACORA", "EXP_BITACORA_DET"], 60, y0 + 380),
        ("Catálogos y correlativos", ["PRODUCTO_CATALOGO", "PRODUCTO_CATALOGO_CFG", "SIAF_CORR_CFG", "SIAF_CORR_RESERVA", "EXP_CORR_CFG"], 700, y0 + 380),
    ]

    boxes = []
    for title, ents, x, y in modules:
        box_h = 48 + len(ents) * 22 + 16
        draw.rounded_rectangle((x, y, x + 380, y + box_h), radius=10, fill=BOX, outline=HEADER, width=2)
        draw.rounded_rectangle((x, y, x + 380, y + 36), radius=10, fill=HEADER)
        draw.rectangle((x, y + 18, x + 380, y + 36), fill=HEADER)
        draw.text((x + 16, y + 8), title, fill=HEADER_TXT, font=F_TITLE)
        yy = y + 48
        for e in ents:
            draw.ellipse((x + 18, yy + 4, x + 28, yy + 14), fill=ACCENT)
            draw.text((x + 36, yy), e, fill=ATTR, font=F_ATTR)
            yy += 22
        boxes.append((x, y, x + 380, y + box_h))

    # Links between modules (conceptual)
    draw_footer(
        draw,
        w,
        h,
        "Figura parte A. Vista de módulos. Las partes B–E detallan atributos, PK/FK y cardinalidades. Elaboración propia a partir de entidades TypeORM.",
    )
    path = OUT / "er_parte_a_mapa_modulos.png"
    img.save(path, "PNG")
    return path


# ─── Parte B: Seguridad + organización ───────────────────────────────────────

def parte_b_seguridad_org():
    w, h = 1600, 1100
    img, draw = new_canvas(w, h)
    y0 = draw_banner(draw, "Parte B — Seguridad, acceso y estructura organizacional", w)

    usuario = EntityBox(
        "USUARIO",
        ["PK id", "codigo_empleado (UQ)", "correo_institucional (UQ)", "dpi / nit (UQ)", "nombres, apellidos", "FK puesto_id", "FK departamento_id", "unidad_medica (texto)"],
        620, y0 + 20, 250,
    )
    cred = EntityBox(
        "CREDENCIAL",
        ["PK id", "FK usuario_id", "codigo_empleado (UQ)", "password_hash", "temporal (isTempPassword)"],
        620, y0 + 320, 250,
    )
    rol = EntityBox("ROL", ["PK id", "nombre (UQ)"], 280, y0 + 80, 180)
    perm = EntityBox("PERMISO", ["PK id", "nombre (UQ)", "descripcion"], 40, y0 + 80, 180)
    ur = EntityBox("user_roles", ["FK user_id", "FK role_id"], 420, y0 + 280, 160)
    rp = EntityBox("role_permissions", ["FK role_id", "FK permission_id"], 120, y0 + 280, 180)
    puesto = EntityBox("PUESTO", ["PK id", "nombre (UQ)", "activo"], 980, y0 + 40, 180)
    depto = EntityBox("DEPARTAMENTO", ["PK id", "nombre (UQ)"], 1240, y0 + 40, 200)
    muni = EntityBox("MUNICIPIO", ["PK id", "nombre", "FK departamento_id"], 1240, y0 + 220, 200)
    unidad = EntityBox("UNIDAD_MEDICA", ["PK id", "nombre (UQ)", "codigo (UQ)", "FK municipio_id", "direccion, telefonos"], 1240, y0 + 420, 220)
    area = EntityBox("AREA", ["PK id", "nombre (UQ)", "descripcion", "activo", "created_at / updated_at"], 980, y0 + 320, 200)

    entities = [usuario, cred, rol, perm, ur, rp, puesto, depto, muni, unidad, area]
    for e in entities:
        draw_entity(draw, e, join=e.name in ("user_roles", "role_permissions"))

    draw_link(draw, usuario, cred, "1 : 1")
    draw_link(draw, usuario, ur, "1 : N")
    draw_link(draw, ur, rol, "N : 1")
    draw_link(draw, rol, rp, "1 : N")
    draw_link(draw, rp, perm, "N : 1")
    draw_link(draw, usuario, puesto, "N : 1")
    draw_link(draw, usuario, depto, "N : 1")
    draw_link(draw, depto, muni, "1 : N")
    draw_link(draw, muni, unidad, "1 : N")
    draw_link(draw, usuario, unidad, "lógico (texto)", dashed=True)

    draw.text(
        (40, h - 70),
        "Nota. user_roles y role_permissions son tablas de unión M:N. La relación Usuario–Unidad médica es lógica (campo texto), no FK.",
        fill=NOTE,
        font=F_SMALL,
    )
    draw_footer(draw, w, h, "Elaboración propia a partir de User, Credential, Role, Permission, Puesto, Departamento, Municipio, UnidadMedica y Area.")
    path = OUT / "er_parte_b_seguridad_org.png"
    img.save(path, "PNG")
    return path


# ─── Parte C: SIAF ───────────────────────────────────────────────────────────

def parte_c_siaf():
    w, h = 1600, 1050
    img, draw = new_canvas(w, h)
    y0 = draw_banner(draw, "Parte C — Módulo SIAF (solicitudes, ítems, autorización y bitácora)", w)

    siaf = EntityBox(
        "SIAF_SOLICITUD",
        [
            "PK id",
            "correlativo (UQ)",
            "fecha, estado",
            "justificacion, unidad…",
            "FK usuario_solicitante_id",
            "FK usuario_autoridad_id",
            "FK usuario_encargado_id",
            "FK area_id",
            "pdf_path / pdf_hash",
        ],
        620, y0 + 40, 280,
    )
    item = EntityBox(
        "SIAF_ITEM",
        ["PK id", "FK siaf_id", "codigo", "catalogo_origen", "descripcion", "cantidad, orden"],
        40, y0 + 40, 220,
    )
    sub = EntityBox(
        "SIAF_SUBPRODUCTO",
        ["PK id", "FK siaf_id", "codigo", "cantidad", "orden"],
        40, y0 + 320, 220,
    )
    aut = EntityBox(
        "SIAF_AUTORIZACION",
        ["PK id", "FK siaf_id", "FK usuario_autorizador_id", "accion", "comentario", "motivos_rechazo", "fecha_autorizacion"],
        1100, y0 + 40, 280,
    )
    bit = EntityBox(
        "SIAF_BITACORA",
        ["PK id", "FK siaf_id", "FK usuario_id", "tipo", "comentario", "detalle_antes/después", "fecha"],
        1100, y0 + 340, 280,
    )
    adj = EntityBox(
        "SIAF_DOCUMENTO_ADJUNTO",
        ["PK id", "FK siaf_id", "nombre_original", "ruta_archivo", "mime_type", "hash_archivo", "fecha_subida"],
        620, y0 + 480, 280,
    )
    user = EntityBox("USUARIO", ["PK id", "(solicitante / autoridad", "/ encargado / autorizador)"], 300, y0 + 620, 240)
    area = EntityBox("AREA", ["PK id", "nombre"], 620, y0 + 720, 180)
    cat = EntityBox("PRODUCTO_CATALOGO", ["PK id", "origen + codigo (UQ)", "(vínculo lógico por código)"], 1100, y0 + 680, 260)

    for e in [siaf, item, sub, aut, bit, adj, user, area, cat]:
        draw_entity(draw, e)

    draw_link(draw, siaf, item, "1 : N")
    draw_link(draw, siaf, sub, "1 : N")
    draw_link(draw, siaf, aut, "1 : N")
    draw_link(draw, siaf, bit, "1 : N")
    draw_link(draw, siaf, adj, "1 : N")
    draw_link(draw, siaf, user, "N : 1")
    draw_link(draw, aut, user, "N : 1")
    draw_link(draw, bit, user, "N : 1")
    draw_link(draw, siaf, area, "N : 1")
    draw_link(draw, item, cat, "lógico", dashed=True)

    draw.text(
        (40, h - 70),
        "Nota. SiafItem se asocia lógicamente a ProductoCatalogo mediante codigo + catalogo_origen (sin FK ORM).",
        fill=NOTE,
        font=F_SMALL,
    )
    draw_footer(draw, w, h, "Elaboración propia a partir de SiafSolicitud, SiafItem, SiafSubproducto, SiafAutorizacion, SiafBitacora y SiafDocumentoAdjunto.")
    path = OUT / "er_parte_c_siaf.png"
    img.save(path, "PNG")
    return path


# ─── Parte D: Expedientes ────────────────────────────────────────────────────

def parte_d_expedientes():
    w, h = 1600, 1000
    img, draw = new_canvas(w, h)
    y0 = draw_banner(draw, "Parte D — Módulo de expedientes, documentos, versiones y bitácora", w)

    exp = EntityBox(
        "EXPEDIENTE",
        [
            "PK id",
            "numero_expediente (UQ)",
            "FK usuario_id",
            "tipo, titulo, estado",
            "numero_siaf (texto)",
            "orden_compra, fechas",
            "unidad/municipio origen",
        ],
        620, y0 + 30, 260,
    )
    doc = EntityBox(
        "EXP_DOCUMENTO",
        ["PK id", "FK expediente_id", "FK subido_por", "tipo_documento", "nombre/ruta", "hash_archivo", "fecha_subida"],
        200, y0 + 280, 250,
    )
    ver = EntityBox(
        "EXP_VERSION",
        ["PK id", "FK expediente_documento_id", "numero_version", "es_actual", "hash_archivo", "FK subido_por"],
        40, y0 + 600, 260,
    )
    bit = EntityBox(
        "EXP_BITACORA",
        ["PK id", "FK expediente_id", "FK usuario_id", "tipo", "comentario", "fecha", "doc_id / version_id (int)"],
        1000, y0 + 280, 280,
    )
    det = EntityBox(
        "EXP_BITACORA_DETALLE",
        ["PK id", "FK bitacora_id", "FK expediente_documento_id", "nombre_documento", "comentario", "pagina, x%, y%"],
        1000, y0 + 580, 300,
    )
    user = EntityBox("USUARIO", ["PK id", "(titular / sube docs", "/ registra bitácora)"], 620, y0 + 520, 220)
    siaf = EntityBox("SIAF_SOLICITUD", ["correlativo", "(vínculo lógico", "via numero_siaf)"], 980, y0 + 40, 220)

    for e in [exp, doc, ver, bit, det, user, siaf]:
        draw_entity(draw, e)

    draw_link(draw, exp, doc, "1 : N")
    draw_link(draw, doc, ver, "1 : N")
    draw_link(draw, exp, bit, "1 : N")
    draw_link(draw, bit, det, "1 : N")
    draw_link(draw, det, doc, "N : 1")
    draw_link(draw, exp, user, "N : 1")
    draw_link(draw, doc, user, "N : 1")
    draw_link(draw, bit, user, "N : 1")
    draw_link(draw, exp, siaf, "lógico", dashed=True)

    draw.text(
        (40, h - 70),
        "Nota. Expediente.numero_siaf referencia el correlativo SIAF como texto (sin FK). Bitácora puede apuntar a documento/versión por enteros opcionales.",
        fill=NOTE,
        font=F_SMALL,
    )
    draw_footer(draw, w, h, "Elaboración propia a partir de Expediente, ExpedienteDocumento, ExpedienteDocumentoVersion, ExpedienteBitacora y ExpedienteBitacoraDetalle.")
    path = OUT / "er_parte_d_expedientes.png"
    img.save(path, "PNG")
    return path


# ─── Parte E: Catálogos y correlativos ───────────────────────────────────────

def parte_e_catalogos():
    w, h = 1500, 900
    img, draw = new_canvas(w, h)
    y0 = draw_banner(draw, "Parte E — Catálogo de productos y correlativos SIAF / expedientes", w)

    prod = EntityBox(
        "PRODUCTO_CATALOGO",
        ["PK id", "origen (MINFIN/SIBOFA/SUBPRODUCTOS)", "codigo", "descripcion", "datos_originales (jsonb)", "UQ (origen, codigo)", "created_at"],
        80, y0 + 60, 320,
    )
    cfg = EntityBox(
        "PRODUCTO_CATALOGO_CONFIG",
        ["PK origen", "encabezados (jsonb)", "columna_codigo", "columnas_descripcion", "updated_at"],
        80, y0 + 420, 320,
    )
    scfg = EntityBox(
        "SIAF_CORRELATIVO_CONFIG",
        ["PK id", "siguiente_numero", "numero_inicio", "digitos", "minutos_reserva", "anio_actual"],
        520, y0 + 60, 300,
    )
    sres = EntityBox(
        "SIAF_CORRELATIVO_RESERVA",
        ["PK id", "numero / correlativo", "FK usuario_id", "estado (reservado/consumido/liberado)", "token", "reservado_en / expira_en"],
        520, y0 + 360, 320,
    )
    ecfg = EntityBox(
        "EXP_CORRELATIVO_CONFIG",
        ["PK id", "siguiente_numero", "numero_inicio", "digitos", "anio_actual"],
        980, y0 + 60, 300,
    )
    user = EntityBox("USUARIO", ["PK id"], 980, y0 + 360, 180)
    item = EntityBox("SIAF_ITEM", ["codigo + catalogo_origen"], 980, y0 + 520, 220)

    for e in [prod, cfg, scfg, sres, ecfg, user, item]:
        draw_entity(draw, e)

    draw_link(draw, prod, cfg, "1 : 1 lógico", dashed=True)
    draw_link(draw, sres, user, "N : 1")
    draw_link(draw, item, prod, "lógico", dashed=True)

    draw.text(
        (40, h - 90),
        "Nota. Las tablas de configuración de correlativos son globales (una fila operativa). ProductoCatalogoConfig usa origen como PK.",
        fill=NOTE,
        font=F_SMALL,
    )
    draw_footer(draw, w, h, "Elaboración propia a partir de ProductoCatalogo, ProductoCatalogoConfig, SiafCorrelativoConfig, SiafCorrelativoReserva y ExpedienteCorrelativoConfig.")
    path = OUT / "er_parte_e_catalogos_correlativos.png"
    img.save(path, "PNG")
    return path


def main():
    paths = [
        parte_a_mapa(),
        parte_b_seguridad_org(),
        parte_c_siaf(),
        parte_d_expedientes(),
        parte_e_catalogos(),
    ]
    print("Generados:")
    for p in paths:
        print(" ", p)


if __name__ == "__main__":
    main()
