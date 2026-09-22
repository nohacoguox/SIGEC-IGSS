# -*- coding: utf-8 -*-
"""Genera capturas de código y sustituye las tablas editables por imágenes."""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.shared import Cm, Pt
from docx.text.paragraph import Paragraph

sys.path.insert(0, r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\herramientas")
from insertar_codigo_54 import LISTINGS, SRC, REPO  # noqa: E402

OUT = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\diagramas_cap5\codigo")
OUT.mkdir(parents=True, exist_ok=True)

BG = (248, 249, 251)
HEADER = (24, 58, 90)
HEADER_TXT = (255, 255, 255)
GUTTER = (232, 236, 240)
LN = (140, 150, 160)
TEXT = (36, 42, 50)
KW = (10, 80, 160)
STR = (46, 125, 50)
CMT = (110, 120, 128)
FN = (120, 70, 160)
NUM = (160, 90, 30)
PUN = (70, 80, 90)

KEYWORDS = {
    "const", "let", "var", "function", "async", "await", "return", "if", "else",
    "export", "import", "from", "new", "typeof", "null", "true", "false",
    "try", "catch", "for", "of", "in", "class", "extends", "private", "public",
    "string", "number", "boolean", "Buffer", "Promise",
}

TOKEN = re.compile(
    r"(//[^\n]*)|"
    r"(`(?:\\.|[^`])*`)|"
    r"('(?:\\.|[^'\\])*')|"
    r'("(?:\\.|[^"\\])*")|'
    r"\b([A-Za-z_][A-Za-z0-9_]*)\b|"
    r"(\d+)|"
    r"(\s+)|"
    r"(.)",
)


def font(size, bold=False):
    names = [
        r"C:\Windows\Fonts\consola.ttf" if not bold else r"C:\Windows\Fonts\consolab.ttf",
        r"C:\Windows\Fonts\cour.ttf",
        r"C:\Windows\Fonts\cascadiamono.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_CODE = font(15)
F_BOLD = font(15, True)
F_FILE = font(13, True)
F_LN = font(13)


def color_for(kind, lex):
    if kind == "cmt":
        return CMT
    if kind == "str":
        return STR
    if kind == "id":
        if lex in KEYWORDS:
            return KW
        return TEXT
    if kind == "num":
        return NUM
    return TEXT


def tokenize_line(line: str):
    tokens = []
    for m in TOKEN.finditer(line):
        cmt, bt, sq, dq, ident, num, sp, other = m.groups()
        if cmt:
            tokens.append(("cmt", cmt))
        elif bt or sq or dq:
            tokens.append(("str", bt or sq or dq))
        elif ident:
            tokens.append(("id", ident))
        elif num:
            tokens.append(("num", num))
        elif sp:
            tokens.append(("sp", sp))
        else:
            tokens.append(("p", other or ""))
    return tokens


def render(path: Path, filename: str, code: str):
    lines = code.replace("\t", "    ").splitlines()
    pad_x, pad_y = 18, 14
    ln_w = 52
    line_h = 22
    header_h = 36
    # measure width
    dummy = Image.new("RGB", (10, 10))
    d0 = ImageDraw.Draw(dummy)
    max_w = 0
    for line in lines:
        max_w = max(max_w, int(d0.textlength(line.replace(" ", "x"), font=F_CODE)))
    w = max(920, ln_w + pad_x * 2 + max_w + 28)
    h = header_h + pad_y * 2 + line_h * len(lines) + 10
    img = Image.new("RGB", (w, h), BG)
    dr = ImageDraw.Draw(img)
    dr.rectangle((0, 0, w, header_h), fill=HEADER)
    dr.text((16, 9), filename, fill=HEADER_TXT, font=F_FILE)
    dr.rectangle((0, header_h, ln_w, h), fill=GUTTER)

    y = header_h + pad_y
    for i, line in enumerate(lines, 1):
        ln = str(i)
        tw = dr.textlength(ln, font=F_LN)
        dr.text((ln_w - 10 - tw, y + 2), ln, fill=LN, font=F_LN)
        x = ln_w + 12
        for kind, lex in tokenize_line(line):
            fill = color_for(kind, lex)
            if kind == "id" and lex not in KEYWORDS:
                # function-ish: next visible is (
                fill = TEXT
            dr.text((x, y), lex.replace(" ", " "), fill=fill, font=F_CODE)
            x += dr.textlength(lex, font=F_CODE)
        y += line_h

    # border
    dr.rectangle((0, 0, w - 1, h - 1), outline=(180, 188, 196), width=1)
    img.save(path, "PNG", optimize=True)
    print("OK", path.name, img.size)
    return path


def replace_tables_with_images(doc: Document, images: list[Path]):
    tbls = [doc.tables[i]._tbl for i in range(37, 43)]
    if len(tbls) != 6:
        raise SystemExit(f"Se esperaban 6 tablas de código, hay {len(tbls)}")
    for tbl, img in zip(tbls, images):
        new_p = OxmlElement("w:p")
        tbl.addnext(new_p)
        parent = tbl.getparent()
        parent.remove(tbl)
        p = Paragraph(new_p, doc)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.first_line_indent = Cm(0)
        pf.space_before = Pt(4)
        pf.space_after = Pt(6)
        run = p.add_run()
        run.add_picture(str(img), width=Cm(15.8))


def main():
    images = []
    for i, (_num, _title, filename, code, _note) in enumerate(LISTINGS, 1):
        img = render(OUT / f"codigo_{i:02d}.png", filename, code)
        images.append(img)

    shutil.copyfile(SRC, SRC.with_name("TERCERA_ENTREGA_CAPITULO_V_ANTES_IMG_CODIGO.docx"))
    doc = Document(str(SRC))
    replace_tables_with_images(doc, images)
    doc.save(str(SRC))
    try:
        shutil.copyfile(SRC, REPO)
    except OSError:
        pass
    print("saved", SRC)


if __name__ == "__main__":
    main()
