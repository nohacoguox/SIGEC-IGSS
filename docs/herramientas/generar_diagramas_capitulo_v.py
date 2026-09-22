# -*- coding: utf-8 -*-
"""Diagramas del Capítulo V — Diseño de la solución SIGEC-IGSS."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "diagramas_cap5"
OUT.mkdir(parents=True, exist_ok=True)

BG = (248, 250, 252)
HEADER = (24, 58, 90)
HEADER_TXT = (255, 255, 255)
BOX = (255, 255, 255)
BORDER = (40, 70, 100)
ATTR = (45, 55, 72)
LINE = (70, 90, 110)
ACCENT = (30, 100, 140)
GREEN = (90, 130, 50)
NOTE = (100, 110, 120)
SOFT = (232, 238, 244)
IGSS_AZUL = (59, 107, 133)
IGSS_VERDE = (107, 142, 56)


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


F_BANNER = font(16, True)
F_TITLE = font(14, True)
F_H = font(13, True)
F_B = font(12, True)
F_N = font(11)
F_S = font(10)
F_XS = font(9)


def canvas(w, h):
    img = Image.new("RGB", (w, h), BG)
    return img, ImageDraw.Draw(img)


def banner(draw, w, text, y=16):
    draw.rounded_rectangle((20, y, w - 20, y + 42), radius=8, fill=HEADER)
    draw.text((36, y + 11), text, fill=HEADER_TXT, font=F_BANNER)
    return y + 58


def rbox(draw, xy, fill=BOX, outline=BORDER, radius=10, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def centered(draw, text, cx, y, fnt, fill=ATTR):
    tw = draw.textlength(text, font=fnt)
    draw.text((cx - tw / 2, y), text, fill=fill, font=fnt)


def wrap(draw, text, x, y, fnt, fill, max_w, lh=16):
    words = text.split()
    line = ""
    yy = y
    for w in words:
        test = (line + " " + w).strip()
        if draw.textlength(test, font=fnt) <= max_w:
            line = test
        else:
            draw.text((x, yy), line, fill=fill, font=fnt)
            yy += lh
            line = w
    if line:
        draw.text((x, yy), line, fill=fill, font=fnt)
        yy += lh
    return yy


def header_bar(draw, x1, y1, x2, y2, title, fill=HEADER):
    rbox(draw, (x1, y1, x2, y2), fill=BOX, outline=fill)
    draw.rounded_rectangle((x1, y1, x2, y1 + 28), radius=8, fill=fill)
    draw.rectangle((x1, y1 + 14, x2, y1 + 28), fill=fill)
    draw.text((x1 + 12, y1 + 6), title, fill=HEADER_TXT, font=F_B)


def save(img, name):
    path = OUT / name
    img.save(path, "PNG", optimize=True)
    print("OK", path.name, img.size)
    return path


def arquitectura_solucion():
    w, h = 1500, 980
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Arquitectura de la solución (vista de contenedores)")

    # Actores
    actors = [("Colaborador", 80), ("Analista DAF", 280), ("Administrador", 480)]
    for name, x in actors:
        rbox(d, (x, 80, x + 170, 140), fill=(236, 244, 232), outline=GREEN)
        centered(d, name, x + 85, 102, F_B, GREEN)

    d.line((165, 140, 165, 175), fill=LINE, width=2)
    d.line((365, 140, 750, 175), fill=LINE, width=2)
    d.line((565, 140, 750, 175), fill=LINE, width=2)
    centered(d, "HTTPS / HTTP  •  navegador institucional", 750, 155, F_S, NOTE)

    # SPA
    header_bar(d, 60, 190, 1440, 330, "Capa de presentación — SPA React 18 + TypeScript + Material UI")
    boxes = [
        (80, "Login / sesión", "JWT en cliente"),
        (360, "Panel administrador", "Usuarios, roles, catálogos"),
        (640, "Panel colaborador", "SIAF, expedientes, DAF"),
        (920, "Analítica", "Recharts + filtros"),
        (1160, "Visores PDF", "SIAF y expedientes"),
    ]
    for x, t, s in boxes:
        rbox(d, (x, 232, x + 230, 312), fill=SOFT, outline=IGSS_AZUL)
        centered(d, t, x + 115, 250, F_B, HEADER)
        centered(d, s, x + 115, 274, F_S, NOTE)

    centered(d, "JSON / REST  •  Authorization: Bearer  •  proxy /api → 127.0.0.1:3001", 750, 345, F_S, ACCENT)

    # API
    header_bar(d, 60, 370, 1440, 620, "Capa de aplicación — API REST Node.js + Express + TypeORM")
    mods = [
        (80, 418, "auth", "Login, JWT, recuperación"),
        (300, 418, "rbac", "Roles, permisos, pantallas"),
        (520, 418, "usuarios", "CRUD y asignación"),
        (740, 418, "catalogos", "Áreas, puestos, unidades"),
        (960, 418, "siaf", "Ciclo de solicitud"),
        (1180, 418, "expedientes", "Docs y versiones"),
        (80, 510, "correlativos", "Reserva y secuencia"),
        (300, 510, "catalogoProductos", "Excel MINFIN/SIBOFA"),
        (520, 510, "estadisticas", "Indicadores y cortes"),
        (740, 510, "FileStorage", "Disco + SHA-256"),
        (960, 510, "PdfGenerator", "Constancia SIAF"),
        (1180, 510, "correo / LT", "Recuperación y texto"),
    ]
    for x, y, t, s in mods:
        rbox(d, (x, y, x + 200, y + 72), outline=ACCENT)
        centered(d, t, x + 100, y + 12, F_B, ACCENT)
        centered(d, s, x + 100, y + 36, F_S, ATTR)

    # Persistencia
    header_bar(d, 60, 650, 720, 900, "Persistencia relacional")
    wrap(d, "PostgreSQL  •  base igss  •  esquema sigec_igss", 80, 698, F_N, ATTR, 600)
    wrap(d, "25 entidades TypeORM y 2 tablas de unión (user_roles, role_permissions). Transacciones ACID para correlativo, solicitud, bitácora y metadatos de archivo.", 80, 728, F_N, ATTR, 600, 18)
    rbox(d, (80, 810, 330, 880), fill=(235, 242, 250), outline=HEADER)
    centered(d, "Tablas de negocio", 205, 828, F_B, HEADER)
    centered(d, "SIAF, expedientes, RBAC", 205, 850, F_S, NOTE)
    rbox(d, (360, 810, 680, 880), fill=(235, 242, 250), outline=HEADER)
    centered(d, "Metadatos de archivo", 520, 828, F_B, HEADER)
    centered(d, "ruta, hash, tamaño, MIME", 520, 850, F_S, NOTE)

    header_bar(d, 760, 650, 1440, 900, "Almacén de documentos (disco)")
    wrap(d, "Directorio uploads/ del backend. Los bytes no se guardan en PostgreSQL; la base solo referencia la ruta relativa y la huella SHA-256.", 780, 698, F_N, ATTR, 620)
    folders = [
        (780, "uploads/siaf/AAAA/MM/", "PDF de solicitud"),
        (1000, "uploads/siaf-adjuntos/", "Especificaciones"),
        (1220, "uploads/expedientes/", "Versiones documentales"),
    ]
    for x, t, s in folders:
        rbox(d, (x, 790, x + 200, 870), fill=(236, 244, 232), outline=GREEN)
        centered(d, t, x + 100, 808, F_S, GREEN)
        centered(d, s, x + 100, 832, F_S, ATTR)

    d.text((28, h - 28), "Elaboración propia a partir del prototipo SIGEC-IGSS (React + Express + PostgreSQL).", fill=NOTE, font=F_S)
    save(img, "arquitectura_solucion.png")


def arquitectura_despliegue():
    w, h = 1500, 860
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Arquitectura de despliegue del piloto (Palín – DAF Escuintla)")

    header_bar(d, 40, 80, 480, 250, "Estación del usuario (LAN IGSS)")
    wrap(d, "PC institucional con navegador. Accede por IP fija http://10.4.201.74. No instala cliente pesado. El token JWT viaja en cabecera Authorization.", 60, 128, F_N, ATTR, 400, 18)

    header_bar(d, 520, 80, 1460, 800, "Servidor piloto — Debian 12  •  Dell OptiPlex Micro  •  IP 10.4.201.74")

    rbox(d, (560, 140, 1420, 250), fill=SOFT, outline=IGSS_AZUL)
    d.text((580, 155), "Nginx (puerto 80) — punto único de entrada", fill=HEADER, font=F_H)
    wrap(d, "Sirve frontend/build (SPA). Encaminamiento /api/ → 127.0.0.1:3001. Listo para HTTPS cuando el IGSS entregue certificado institucional.", 580, 188, F_N, ATTR, 800, 18)

    rbox(d, (560, 280, 980, 430), outline=ACCENT)
    d.text((580, 296), "PM2  •  proceso sigec-igss-api", fill=ACCENT, font=F_H)
    wrap(d, "Node.js + Express en puerto 3001, solo localhost. Reinicio automático y registros de ejecución.", 580, 330, F_N, ATTR, 370, 18)

    rbox(d, (1000, 280, 1420, 430), outline=ACCENT)
    d.text((1020, 296), "Variables de entorno", fill=ACCENT, font=F_H)
    wrap(d, "DB_*, JWT_SECRET, correo y rutas de archivo. Secretos fuera de Git.", 1020, 330, F_N, ATTR, 370, 18)

    rbox(d, (560, 460, 980, 640), fill=(235, 242, 250), outline=HEADER)
    d.text((580, 476), "PostgreSQL", fill=HEADER, font=F_H)
    wrap(d, "Base igss, esquema sigec_igss, rol de aplicación. Volcado lógico para respaldo.", 580, 514, F_N, ATTR, 370, 18)

    rbox(d, (1000, 460, 1420, 640), fill=(236, 244, 232), outline=GREEN)
    d.text((1020, 476), "Disco  •  backend/uploads", fill=GREEN, font=F_H)
    wrap(d, "PDF SIAF, adjuntos y versiones de expedientes. Se respalda junto con la base para evitar metadatos huérfanos.", 1020, 514, F_N, ATTR, 370, 18)

    rbox(d, (560, 670, 1420, 770), fill=BOX, outline=BORDER)
    wrap(d, "UFW: SSH + HTTP. Desarrollo en Windows; producción en Debian. El mismo repositorio se compila en ambos entornos. La URL del API queda congelada en el build (REACT_APP_API_URL).", 580, 690, F_N, ATTR, 800, 18)

    d.polygon([(480, 165), (520, 165), (500, 185)], fill=LINE)
    d.line((480, 165, 520, 165), fill=LINE, width=3)

    d.text((28, h - 28), "Elaboración propia según la guía de despliegue del piloto SIGEC-IGSS.", fill=NOTE, font=F_S)
    save(img, "arquitectura_despliegue.png")


def almacenamiento_hibrido():
    w, h = 1480, 900
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Almacenamiento híbrido de documentos")

    header_bar(d, 40, 80, 720, 430, "Metadatos en PostgreSQL")
    items = [
        "siaf_solicitudes.pdfPath / pdfHash / pdfSize",
        "siaf_documentos_adjuntos (nombre, MIME, hash, ruta)",
        "expediente_documentos (tipo, ruta, hash, subido_por)",
        "expediente_documento_versiones (es_actual, n.º versión)",
        "Bitácoras con antes/después y usuario responsable",
    ]
    y = 128
    for t in items:
        d.ellipse((70, y + 6, 82, y + 18), fill=ACCENT)
        wrap(d, t, 96, y, F_N, ATTR, 580, 18)
        y += 48

    header_bar(d, 760, 80, 1440, 430, "Bytes en sistema de archivos")
    tree = [
        "uploads/",
        "  siaf/AAAA/MM/SIAF-n-anio.pdf",
        "  siaf-adjuntos/AAAA/MM/siaf-id-ts-nombre.ext",
        "  expedientes/EXP-n/archivo-timestamp.ext",
        "Nombres sanitizados (sin / del correlativo)",
    ]
    y = 128
    for t in tree:
        wrap(d, t, 790, y, F_N, ATTR, 610, 18)
        y += 42

    header_bar(d, 40, 460, 1440, 840, "Garantías de integridad, versionado y restauración")
    cols = [
        (70, "Integridad", "SHA-256 al guardar. Permite detectar corrupción o sustitución accidental del fichero en disco."),
        (520, "Versionado", "Cada reemplazo en expediente genera una fila de versión. El actual se marca con es_actual; DAF revisa la versión señalada."),
        (970, "Respaldo conjunto", "pg_dump del esquema + copia de uploads/. Restaurar base sin archivos (o viceversa) deja evidencias huérfanas."),
    ]
    for x, t, s in cols:
        rbox(d, (x, 520, x + 420, 800), fill=SOFT, outline=HEADER)
        centered(d, t, x + 210, 545, F_H, HEADER)
        wrap(d, s, x + 24, 590, F_N, ATTR, 372, 20)

    d.text((28, h - 28), "Elaboración propia a partir de FileStorageService y las entidades TypeORM de SIAF y expedientes.", fill=NOTE, font=F_S)
    save(img, "almacenamiento_hibrido.png")


def flujo_capas():
    w, h = 1480, 820
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Flujo de una petición autenticada a través de las capas")

    steps = [
        (60, "1. Navegador", "SPA React envía HTTP + JWT"),
        (340, "2. Nginx", "Estáticos o proxy /api"),
        (620, "3. Express", "verifyToken + permisos"),
        (900, "4. Dominio", "Servicio / repositorio"),
        (1180, "5. Persistencia", "PostgreSQL y/o disco"),
    ]
    for i, (x, t, s) in enumerate(steps):
        rbox(d, (x, 100, x + 240, 210), fill=HEADER if i % 2 == 0 else IGSS_AZUL)
        centered(d, t, x + 120, 125, F_H, HEADER_TXT)
        centered(d, s, x + 120, 160, F_S, (230, 240, 248))
        if i < len(steps) - 1:
            d.polygon([(x + 250, 145), (x + 270, 155), (x + 250, 165)], fill=ACCENT)

    header_bar(d, 60, 250, 1420, 760, "Ejemplo: enviar SIAF a revisión DAF")
    lines = [
        "El colaborador confirma el envío en el Libro SIAF. La SPA llama PUT/POST sobre /api/siaf/:id con el token de sesión.",
        "Nginx reenvía al proceso Node (PM2). El middleware verifyToken valida el JWT; authorizeRoles/permisos comprueba crear-siaf o el permiso equivalente.",
        "El módulo siaf actualiza estado, escribe siaf_bitacora (usuario, fecha, detalle) y conserva el PDF ya generado (pdfPath, pdfHash).",
        "TypeORM persiste en transacción. La respuesta JSON refresca la bandeja del colaborador y habilita la aparición en la bandeja DAF.",
        "El analista DAF, con permiso revisar-siaf-direccion-departamental, dictamina. Una nueva fila de autorización y bitácora deja constancia auditable.",
        "La interfaz nunca es la autoridad: un botón oculto no impide una petición forjada; la API rechaza la operación si el permiso no existe en servidor.",
    ]
    y = 300
    for i, t in enumerate(lines, 1):
        d.ellipse((90, y + 4, 118, y + 32), fill=ACCENT)
        centered(d, str(i), 104, y + 8, F_B, HEADER_TXT)
        wrap(d, t, 136, y, F_N, ATTR, 1240, 18)
        y += 70

    d.text((28, h - 28), "Elaboración propia. Patrón cliente–servidor en tres capas con autorización en servidor.", fill=NOTE, font=F_S)
    save(img, "flujo_capas_peticion.png")


def vistas_arquitectura():
    w, h = 1480, 900
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Vistas de arquitectura (modelo 4+1 de Kruchten)")

    views = [
        (50, 90, "Vista lógica", "Módulos de negocio: autenticación, RBAC, SIAF, expedientes, catálogos, correlativos y analítica. Corresponde a las entidades y casos de uso del Capítulo IV."),
        (520, 90, "Vista de proceso", "Flujos runtime: login, reserva de correlativo, persistencia SIAF, dictamen DAF, versionado documental y cálculo de indicadores."),
        (990, 90, "Vista de desarrollo", "Repositorio monolítico: frontend/ (SPA), backend/src/modules, entity, services, db/migrations. Un historial Git auditable."),
        (50, 430, "Vista física", "Debian 12 + Nginx + PM2 + PostgreSQL + uploads en un servidor Micro. Usuarios en LAN institucional Palín–Escuintla."),
        (520, 430, "Escenarios (+1)", "UC-01 a UC-11 recorren las vistas: autenticarse, crear SIAF, revisar DAF, corregir, expediente, catálogo y analítica."),
        (990, 430, "Preocupaciones", "Trazabilidad, integridad de archivos, RBAC, correlativos únicos, continuidad (respaldo conjunto) y límites del piloto."),
    ]
    for x, y, t, s in views:
        rbox(d, (x, y, x + 440, y + 300), fill=BOX, outline=HEADER, radius=12)
        draw = d
        draw.rounded_rectangle((x, y, x + 440, y + 44), radius=12, fill=HEADER)
        draw.rectangle((x, y + 22, x + 440, y + 44), fill=HEADER)
        draw.text((x + 18, y + 12), t, fill=HEADER_TXT, font=F_H)
        wrap(d, s, x + 20, y + 70, F_N, ATTR, 400, 20)

    d.text((28, h - 28), "Elaboración propia con base en el modelo de vistas 4+1 (Kruchten) aplicado al piloto SIGEC-IGSS.", fill=NOTE, font=F_S)
    save(img, "vistas_arquitectura.png")


def mapa_navegacion():
    w, h = 1500, 920
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Mapa de navegación del prototipo de interfaz")

    rbox(d, (560, 80, 940, 150), fill=HEADER)
    centered(d, "Inicio de sesión  (/login)", 750, 105, F_H, HEADER_TXT)

    d.line((750, 150, 750, 185), fill=LINE, width=2)

    rbox(d, (200, 185, 560, 265), fill=IGSS_AZUL)
    centered(d, "Panel administrador", 380, 205, F_H, HEADER_TXT)
    centered(d, "/admin-dashboard", 380, 232, F_S, (230, 240, 248))

    rbox(d, (940, 185, 1300, 265), fill=IGSS_VERDE)
    centered(d, "Panel colaborador", 1120, 205, F_H, HEADER_TXT)
    centered(d, "/colaborador-dashboard", 1120, 232, F_S, HEADER_TXT)

    admin = [
        "Usuarios", "Roles y permisos", "Áreas", "Puestos",
        "Unidades médicas", "Correlativos", "Dashboard / reportes",
    ]
    y = 290
    for t in admin:
        rbox(d, (220, y, 540, y + 48), fill=SOFT, outline=IGSS_AZUL)
        centered(d, t, 380, y + 14, F_N, HEADER)
        y += 56

    collab = [
        ("Libro SIAF", "Listado, crear, corregir"),
        ("Autorizar SIAF", "Director / encargado"),
        ("Bandeja DAF — SIAF", "Dictamen departamental"),
        ("Bandeja DAF — Expedientes", "Control documental"),
        ("Expedientes de compras", "Versiones y adjuntos"),
        ("Catálogo de productos", "Importación Excel"),
        ("Analítica SIAF / expedientes", "Cierre, tiempos, motivos"),
        ("Cambio de contraseña", "Credencial temporal"),
    ]
    y = 290
    for t, s in collab:
        rbox(d, (960, y, 1320, y + 52), fill=(236, 244, 232), outline=GREEN)
        d.text((980, y + 6), t, fill=GREEN, font=F_B)
        d.text((980, y + 28), s, fill=NOTE, font=F_S)
        y += 58

    wrap(d, "La visibilidad de cada pantalla depende de permisos (APP_SCREENS). Un mismo usuario puede tener ambos paneles si su rol lo autoriza. PrivateRoute impide el acceso sin token; la API vuelve a comprobar la operación.", 80, 780, F_N, ATTR, 1340, 18)
    d.text((28, h - 28), "Elaboración propia a partir de App.tsx, AdminDashboard, CollaboratorDashboard y appScreens.", fill=NOTE, font=F_S)
    save(img, "mapa_navegacion.png")


def diagrama_componentes():
    w, h = 1500, 980
    img, d = canvas(w, h)
    banner(d, w, "SIGEC-IGSS — Diagrama de componentes de programación")

    header_bar(d, 40, 80, 1460, 360, "Componentes de la SPA (frontend/src)")
    fe = [
        (60, 128, "pages", "Login, dashboards,\nSIAF, expedientes"),
        (310, 128, "components", "SiafBook, bandejas,\nanalítica, usuarios"),
        (560, 128, "context", "Tema, SIAF,\nnotificaciones"),
        (810, 128, "hooks", "Permisos y\nsesiones"),
        (1060, 128, "api.ts", "Cliente Axios\n+ token JWT"),
        (1310, 128, "theme", "Colores IGSS\ny estilos"),
        (60, 250, "PrivateRoute", "Rutas protegidas"),
        (310, 250, "HomeRedirect", "Panel según rol"),
        (560, 250, "PdfViewer", "Clic y observaciones"),
        (810, 250, "SiafPdfDocument", "Vista previa PDF"),
        (1060, 250, "RBAC UI", "Oculta menús"),
        (1310, 250, "Recharts", "Indicadores"),
    ]
    for x, y, t, s in fe:
        rbox(d, (x, y, x + 220, y + 100), fill=SOFT, outline=IGSS_AZUL)
        centered(d, t, x + 110, y + 12, F_B, HEADER)
        for i, line in enumerate(s.split("\n")):
            centered(d, line, x + 110, y + 42 + i * 18, F_S, NOTE)

    header_bar(d, 40, 390, 1460, 780, "Componentes del servidor (backend/src)")
    be = [
        (60, 438, "modules/auth", "Login y correo"),
        (310, 438, "modules/rbac", "Roles y pantallas"),
        (560, 438, "modules/siaf", "Flujo SIAF"),
        (810, 438, "modules/expedientes", "Docs y versiones"),
        (1060, 438, "modules/usuarios", "Padrón"),
        (1310, 438, "modules/catalogos", "Org. y geografía"),
        (60, 560, "correlativos", "Reserva / consumo"),
        (310, 560, "catalogoProductos", "Importación"),
        (560, 560, "estadisticas", "Agregados"),
        (810, 560, "entity/*", "Modelo TypeORM"),
        (1060, 560, "FileStorageService", "Disco + hash"),
        (1310, 560, "PdfGenerator", "PDF institucional"),
        (60, 680, "middleware/auth", "JWT y permisos"),
        (310, 680, "data-source", "PostgreSQL"),
        (560, 680, "db/migrations", "Evolución esquema"),
        (810, 680, "seeders", "Arranque piloto"),
        (1060, 680, "ensureSchema", "Parches de datos"),
        (1310, 680, "index.ts", "Composición API"),
    ]
    for x, y, t, s in be:
        rbox(d, (x, y, x + 220, y + 90), fill=(236, 244, 232), outline=GREEN)
        centered(d, t, x + 110, y + 14, F_B, GREEN)
        centered(d, s, x + 110, y + 48, F_S, ATTR)

    wrap(d, "Los componentes se comunican por interfaces REST JSON. El frontend no accede a PostgreSQL ni al disco. Los módulos del backend comparten AppDataSource y las entidades; la autorización se aplica en middleware antes de la lógica de cada recurso.", 60, 800, F_N, ATTR, 1380, 18)
    d.text((28, h - 28), "Elaboración propia a partir de la estructura de código del prototipo SIGEC-IGSS.", fill=NOTE, font=F_S)
    save(img, "diagrama_componentes.png")


def prototipo_pantalla(nombre, titulo, sidebar, cards, note_bar):
    """Wireframe institucional de una pantalla del prototipo."""
    w, h = 1400, 820
    img, d = canvas(w, h)
    # chrome
    d.rectangle((0, 0, w, 36), fill=(40, 44, 52))
    d.ellipse((14, 12, 26, 24), fill=(237, 84, 84))
    d.ellipse((34, 12, 46, 24), fill=(246, 194, 68))
    d.ellipse((54, 12, 66, 24), fill=(80, 180, 90))
    d.text((90, 8), f"SIGEC-IGSS  —  {titulo}", fill=(220, 224, 230), font=F_S)

    # sidebar
    d.rectangle((0, 36, 280, h), fill=HEADER)
    d.text((20, 56), "SIGEC-IGSS", fill=HEADER_TXT, font=F_H)
    d.text((20, 82), "Instituto Guatemalteco\nde Seguridad Social"[:40], fill=(180, 200, 214), font=F_XS)
    yy = 130
    for i, item in enumerate(sidebar):
        fill = IGSS_VERDE if i == 0 else (36, 72, 104)
        d.rounded_rectangle((16, yy, 264, yy + 36), radius=6, fill=fill)
        d.text((28, yy + 8), item, fill=HEADER_TXT, font=F_S)
        yy += 44
    d.rounded_rectangle((16, h - 70, 264, h - 28), radius=6, fill=(180, 50, 50))
    d.text((40, h - 58), "Cerrar sesión", fill=HEADER_TXT, font=F_S)

    # main
    d.rectangle((280, 36, w, h), fill=(245, 247, 250))
    d.text((308, 56), titulo, fill=HEADER, font=F_TITLE)
    d.text((308, 84), note_bar, fill=NOTE, font=F_S)

    # cards
    cols = 2 if len(cards) > 1 else 1
    cw = 500 if cols == 2 else 1020
    for i, (ct, cs) in enumerate(cards):
        col = i % cols
        row = i // cols
        x = 308 + col * (cw + 24)
        y = 130 + row * 150
        rbox(d, (x, y, x + cw, y + 130), fill=BOX, outline=IGSS_AZUL, radius=12)
        d.rectangle((x, y, x + 8, y + 130), fill=IGSS_AZUL)
        d.text((x + 24, y + 16), ct, fill=HEADER, font=F_H)
        wrap(d, cs, x + 24, y + 50, F_N, ATTR, cw - 48, 18)

    save(img, nombre)


def prototipos_ui():
    prototipo_pantalla(
        "ui_login.png",
        "Inicio de sesión",
        ["Acceso institucional"],
        [
            ("Código de empleado y contraseña", "Formulario público. Recupera acceso por correo institucional y exige cambio si la clave es temporal."),
            ("Identidad visual IGSS", "Logo, azul y verde institucionales, tipografía Source Sans 3 y mensaje de uso interno del instituto."),
        ],
        "Ruta pública /login  •  emite JWT y redirige al panel autorizado",
    )
    prototipo_pantalla(
        "ui_admin.png",
        "Panel de administración",
        ["Dashboard", "Usuarios", "Roles", "Áreas", "Puestos", "Unidades médicas", "Correlativos"],
        [
            ("Indicadores de control", "Totales de usuarios, roles e informes SIAF para supervisión del piloto."),
            ("Gestiones maestras", "Menú lateral permanente. Cada ítem exige permiso granular (gestionar-usuarios, gestionar-roles, etc.)."),
        ],
        "Ruta /admin-dashboard  •  perfil administrador / super administrador",
    )
    prototipo_pantalla(
        "ui_colaborador.png",
        "Panel del colaborador",
        ["Inicio", "Libro SIAF", "Expedientes", "Bandeja DAF", "Catálogo", "Analítica"],
        [
            ("Accesos rápidos", "Tarjetas hacia listado SIAF, crear solicitud, expedientes, bandeja DAF y analítica, filtradas por permiso."),
            ("Dos paneles, un sistema", "Si el usuario también administra, puede saltar al panel administrativo sin otra cuenta."),
        ],
        "Ruta /colaborador-dashboard  •  operación cotidiana Consultorio–DAF",
    )
    prototipo_pantalla(
        "ui_siaf.png",
        "Libro SIAF — listado y captura",
        ["Listado SIAF", "Crear SIAF", "Corregir", "Autorizar"],
        [
            ("Listado con estado", "Correlativo, unidad, fechas y estado (borrador, pendiente, autorizado, rechazado). Filtros por alcance."),
            ("Formulario institucional", "Justificación, ítems con código de catálogo, autoridad/encargado, reserva de correlativo y generación de PDF."),
        ],
        "Rutas /siaf-book y /siaf-book/crear  •  UC-04, UC-05 y UC-06",
    )
    prototipo_pantalla(
        "ui_expedientes.png",
        "Expedientes de compras",
        ["Expedientes", "Documentos", "Versiones", "Bitácora"],
        [
            ("Carátula del expediente", "Número, título, SIAF asociado, orden de compra, estado y unidad de origen."),
            ("Gestor documental", "Carga, tipo de documento, visor PDF, reemplazo con versión anterior conservada y observaciones de DAF."),
        ],
        "Ruta /expedientes  •  UC-07 y UC-08",
    )
    prototipo_pantalla(
        "ui_daf.png",
        "Bandeja de revisiones DAF",
        ["Bandeja SIAF", "Bandeja expedientes", "Historial"],
        [
            ("Cola de revisión", "Solicitudes y expedientes pendientes del departamento. Acciones: aprobar o rechazar con motivo estructurado."),
            ("Evidencia del dictamen", "Comentario, bitácora y, en PDF de expediente, marca de página con clic para localizar la observación."),
        ],
        "Vista interna del panel colaborador  •  analista DAF Escuintla",
    )
    prototipo_pantalla(
        "ui_analitica.png",
        "Analítica SIAF y de expedientes",
        ["Análisis SIAF", "Análisis expedientes", "Motivos"],
        [
            ("Cierre mensual", "Aprobados, rechazados al corte, pendientes de corrección y carga en revisión DAF."),
            ("Tiempos y motivos", "Primera respuesta, ciclo completo, devoluciones y frecuencia de motivos de rechazo."),
        ],
        "Estadísticas del prototipo  •  UC-10  •  ventana móvil de consulta",
    )
    prototipo_pantalla(
        "ui_catalogo.png",
        "Catálogo de productos y correlativos",
        ["Catálogo", "Correlativos", "Mapeo Excel"],
        [
            ("Importación controlada", "Excel MINFIN / SIBOFA / subproductos, mapeo de columnas y conservación de fila original (JSONB)."),
            ("Secuencia institucional", "Siguiente número, dígitos, año calendario de Guatemala y reservas temporales anti-colisión."),
        ],
        "Páginas de catálogo y correlativos  •  UC-03 y UC-09",
    )


def main():
    arquitectura_solucion()
    arquitectura_despliegue()
    almacenamiento_hibrido()
    flujo_capas()
    vistas_arquitectura()
    mapa_navegacion()
    diagrama_componentes()
    prototipos_ui()
    print("DIR", OUT)


if __name__ == "__main__":
    main()
