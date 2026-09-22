# -*- coding: utf-8 -*-
"""Inserta extractos de código esencial en el apartado Programación (5.4)."""
from __future__ import annotations

import shutil
import sys
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from docx.text.paragraph import Paragraph as P

ROOT = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\herramientas")
sys.path.insert(0, str(ROOT))
from cap5_lib import Cursor, find_para, set_run  # noqa: E402

SRC = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\TERCERA_ENTREGA_CAPITULO_V.docx")
BACKUP = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_ANTES_CODIGO.docx")
REPO = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_CAPITULO_V.docx")

CODE_LOGIN = r'''authRouter.post('/login', async (req, res) => {
  const { codigoEmpleado, password } = req.body || {};
  const credential = await credentialRepository.findOne({
    where: { codigoEmpleado },
    relations: ['user', 'user.roles', 'user.roles.permissions'],
  });
  if (!credential) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }
  const isValidPassword = await bcrypt.compare(password, credential.password);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }
  const roleNames = (credential.user.roles ?? []).map((r) => r.name);
  const permissions = new Set();
  credential.user.roles?.forEach((r) =>
    r.permissions?.forEach((p) => permissions.add(p.name)),
  );
  const token = jwt.sign(
    { userId: credential.user.id, codigoEmpleado, roles: roleNames,
      permissions: Array.from(permissions) },
    process.env.JWT_SECRET,
    { expiresIn: '24h' },
  );
  res.json({ token, roles: roleNames, permissions: Array.from(permissions),
    isTempPassword: credential.isTempPassword });
});'''

CODE_MW = r'''export const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

export const authorizeRolesOrPermissions =
  (allowedRoles, allowedPermissions) => (req, res, next) => {
    const roles = req.user?.roles ?? [];
    const permissions = req.user?.permissions ?? [];
    const ok = allowedRoles.some((r) => roles.includes(r))
      || allowedPermissions.some((p) => permissions.includes(p));
    if (!ok) {
      return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
    }
    next();
  };'''

CODE_CORR = r'''export async function reservarCorrelativo(usuarioId) {
  await expireReservations();
  return AppDataSource.transaction(async (manager) => {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('sigec_siaf_correlativo'))`,
    );
    const existing = await reservaRepo.findOne({
      where: { usuarioId, estado: 'reservado' },
    });
    if (existing && existing.expiraEn > new Date()) {
      return { correlativo: existing.correlativo, expiraEn: existing.expiraEn };
    }
    // busca el menor número libre del año y crea reserva temporal
    const correlativo = formatCorrelativo(candidate, config.digitos, year);
    const reserva = reservaRepo.create({
      numero: candidate, correlativo, usuarioId,
      estado: 'reservado', expiraEn: addMinutes(config.minutosReserva),
    });
    await reservaRepo.save(reserva);
    return { correlativo, expiraEn: reserva.expiraEn };
  });
}'''

CODE_DAF = r'''siafRouter.post(
  '/:id/aprobar-direccion-departamental',
  verifyToken,
  authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']),
  async (req, res) => {
    const siaf = await siafRepo.findOneBy({ id: Number(req.params.id) });
    if (siaf.estado !== 'pendiente') {
      return res.status(400).json({ message: 'Solo se revisa un SIAF pendiente.' });
    }
    if (!perteneceAlDepartamento(siaf, user)) {
      return res.status(403).json({ message: 'Este SIAF no corresponde a su departamento.' });
    }
    siaf.estado = 'finalizado';
    siaf.aprobadoDireccionDepartamental = true;
    await siafRepo.save(siaf);
    await autRepo.save(autRepo.create({
      siaf, usuarioAutorizador: user, accion: 'autorizado',
    }));
    await bitacoraRepo.save(bitacoraRepo.create({
      siaf, usuario: user, tipo: 'aprobado_dd',
      comentario: 'Revisión favorable de Dirección Departamental.',
    }));
    res.json(siaf);
  },
);'''

CODE_FILE = r'''private generateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async saveSiafPdf(pdfBuffer: Buffer, correlativo: string) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const siafDir = path.join(this.uploadDir, 'siaf', String(year), month);
  this.ensureDirectoryExists(siafDir);
  const fileName = `SIAF-${this.sanitizeFileName(correlativo)}.pdf`;
  fs.writeFileSync(path.join(siafDir, fileName), pdfBuffer);
  return {
    filePath: path.join('siaf', String(year), month, fileName),
    hash: this.generateHash(pdfBuffer),
    size: pdfBuffer.length,
  };
}'''

CODE_UI = r'''function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = JSON.parse(atob(token.split('.')[1]));
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return false;
  }
  return true;
}

const PrivateRoute = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};'''

LISTINGS = [
    (45, "Extracto de código — autenticación y emisión de JWT",
     "backend/src/modules/auth/routes.ts", CODE_LOGIN,
     "El inicio de sesión compara la contraseña con bcrypt, concentra roles y permisos "
     "en el token y avisa si la clave es temporal. Extracto del prototipo; se omiten "
     "validaciones de entrada y el manejo de error de servidor."),
    (46, "Extracto de código — verificación de token y autorización en servidor",
     "backend/src/middleware/auth.ts", CODE_MW,
     "Toda ruta sensible exige JWT válido. La autorización no se delega al navegador: "
     "el servidor comprueba rol o permiso antes de ejecutar la acción. Extracto del prototipo."),
    (47, "Extracto de código — reserva transaccional de correlativo SIAF",
     "backend/src/services/CorrelativoService.ts", CODE_CORR,
     "Un candado transaccional de PostgreSQL evita que dos formularios abiertos reciban "
     "el mismo número; la reserva se reutiliza si aún está vigente. Extracto simplificado "
     "del prototipo (se omite el bucle de búsqueda del menor número libre)."),
    (48, "Extracto de código — dictamen favorable DAF sobre una solicitud SIAF",
     "backend/src/modules/siaf/routes.ts", CODE_DAF,
     "Solo Dirección Departamental autoriza. El cambio de estado, la autorización y la "
     "bitácora se persisten juntos, y se verifica que el SIAF pertenezca al departamento "
     "del analista. Extracto del prototipo."),
    (49, "Extracto de código — almacenamiento del PDF SIAF con huella SHA-256",
     "backend/src/services/FileStorageService.ts", CODE_FILE,
     "Los bytes se guardan por año/mes; en la base queda la ruta relativa, el tamaño y el "
     "hash para verificar integridad al restaurar. Extracto del prototipo."),
    (50, "Extracto de código — protección de rutas en la interfaz (PrivateRoute)",
     "frontend/src/components/PrivateRoute.tsx", CODE_UI,
     "Si el JWT no existe o está vencido, se limpia la sesión y se redirige al login. "
     "La interfaz oculta módulos, pero la autoridad permanece en la API (Figura 46). "
     "Extracto del prototipo."),
]


def shade_cell(cell, fill="F4F4F4"):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def add_code(cur: Cursor, code: str):
    table = cur.doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl = table._tbl
    parent = tbl.getparent()
    parent.remove(tbl)
    if cur.last is None:
        cur.target._p.addprevious(tbl)
    else:
        cur.last.addnext(tbl)
    cur.last = tbl

    cell = table.cell(0, 0)
    shade_cell(cell)
    cell.text = ""
    lines = code.replace("\t", "    ").splitlines() or [""]

    def write_line(p, text):
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        pf = p.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.line_spacing = 1.0
        pf.first_line_indent = Cm(0)
        r = p.add_run(text if text else " ")
        set_run(r, size=8, name="Courier New")

    write_line(cell.paragraphs[0], lines[0])
    for line in lines[1:]:
        write_line(cell.add_paragraph(), line)
    return table


def emit_listing(cur, num, title, _file, code, note):
    cur.para(f"Figura {num}", kind="caption_num")
    cur.para(title, kind="caption_title")
    add_code(cur, code)
    p = cur.para("", kind="note")
    # rehacer nota a 9 pt, como el resto del capítulo
    for child in list(p._p):
        tag = child.tag.split("}")[-1]
        if tag == "r":
            p._p.remove(child)
    r1 = p.add_run("Nota. ")
    set_run(r1, size=9, italic=True)
    r2 = p.add_run(note)
    set_run(r2, size=9)


def patch_intro(doc: Document):
    p = find_para(
        doc,
        lambda x: x.text.startswith("La programación del SIGEC-IGSS se organiza"),
    )
    if p.runs:
        p.runs[0].text = (
            "La programación del SIGEC-IGSS se organiza como monolito modular: una SPA y una API "
            "en el mismo repositorio, con módulos de servidor por dominio y componentes de interfaz "
            "reutilizables. Esta sección identifica los módulos principales, presenta el diagrama de "
            "componentes y muestra extractos esenciales del prototipo (autenticación, autorización, "
            "correlativo, dictamen DAF, integridad de archivos y protección de rutas). No se reproduce "
            "el repositorio completo; los listados se acotan a la lógica que sostiene el trámite "
            "Consultorio–DAF y se presentan como figuras, conforme a la presentación de código en APA."
        )
        for r in p.runs[1:]:
            r.text = ""


def patch_criterios(doc: Document):
    p = find_para(
        doc,
        lambda x: x.text.startswith("Criterios de implementación."),
    )
    extra = (
        " Los extractos de las Figuras 45 a 50 no sustituyen el repositorio versionado; "
        "permiten contrastar, en el cuerpo del capítulo, que las reglas de acceso, numeración, "
        "dictamen e integridad documental están programadas en servidor y no solo dibujadas en la interfaz."
    )
    # append to last run
    if p.runs:
        p.runs[-1].text = (p.runs[-1].text or "") + extra


def update_index(doc: Document):
    f44 = find_para(doc, lambda p: p.text.strip().startswith("Figura 44 "))
    entries = [
        "Figura 45 Extracto de código — autenticación y emisión de JWT",
        "Figura 46 Extracto de código — verificación de token y autorización en servidor",
        "Figura 47 Extracto de código — reserva transaccional de correlativo SIAF",
        "Figura 48 Extracto de código — dictamen favorable DAF sobre una solicitud SIAF",
        "Figura 49 Extracto de código — almacenamiento del PDF SIAF con huella SHA-256",
        "Figura 50 Extracto de código — protección de rutas en la interfaz (PrivateRoute)",
        "Figura 51 Mapa mental del proyecto SIGEC-IGSS (2026)",
        "Figura 52 Matriz operacional SIGEC-IGSS (piloto Palín–DAF Escuintla, 2026)",
    ]
    ppr = f44._p.find(qn("w:pPr"))
    for text in reversed(entries):
        el = OxmlElement("w:p")
        if ppr is not None:
            el.insert(0, deepcopy(ppr))
        f44._p.addnext(el)
        para = P(el, f44._parent)
        r = para.add_run(text)
        r.font.name = "Calibri"


def flatten_annex(doc: Document):
    mapping = [
        ("Mapa mental del proyecto SIGEC-IGSS", 51),
        ("Matriz operacional SIGEC-IGSS", 52),
    ]
    for needle, num in mapping:
        for p in doc.paragraphs:
            style = p.style.name if p.style else ""
            if style == "table of figures":
                continue
            if needle in p.text and "Figura" in p.text:
                title = p.text.split("\n", 1)[-1].strip()
                if title.startswith("Figura "):
                    title = title.split(" ", 2)[-1] if title.count(" ") >= 2 else title
                pPr = p._p.find(qn("w:pPr"))
                for child in list(p._p):
                    if child is not pPr:
                        p._p.remove(child)
                r1 = p.add_run(f"Figura {num}")
                set_run(r1, bold=True)
                r2 = p.add_run("\n" + title)
                set_run(r2)
                print("annex", num, title[:60])
                break


def main():
    shutil.copyfile(SRC, BACKUP)
    print("backup", BACKUP)
    doc = Document(str(SRC))
    patch_intro(doc)

    target = find_para(doc, lambda p: p.text.startswith("Criterios de implementación."))
    cur = Cursor(doc, target)

    cur.para(
        "Extractos esenciales de programación. Las Figuras 45 a 50 presentan fragmentos "
        "del prototipo que materializan las reglas ya especificadas: quién entra, quién "
        "dictamina, cómo se numera una SIAF y cómo se resguarda el PDF. El código se "
        "muestra como figura (tipografía monoespaciada), no como script de instalación. "
        "Se omiten registros de consola, importaciones y ramas de error no indispensables."
    )

    for item in LISTINGS:
        emit_listing(cur, *item)

    patch_criterios(doc)
    update_index(doc)
    flatten_annex(doc)

    doc.save(str(SRC))
    try:
        shutil.copyfile(SRC, REPO)
    except OSError:
        pass
    print("saved", SRC)


if __name__ == "__main__":
    main()
