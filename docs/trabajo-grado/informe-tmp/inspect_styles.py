# -*- coding: utf-8 -*-
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

path = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\SEGUNDA ENTREGA.docx")
doc = Document(str(path))

out = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\informe-tmp\segunda_entrega_ch3.txt")
lines = []
for i, p in enumerate(doc.paragraphs):
    if 528 <= i <= 620:
        style = p.style.name if p.style else ""
        t = p.text
        if t.strip():
            lines.append(f"{i:04d} [{style}] {t}")
out.write_text("\n".join(lines), encoding="utf-8")
print("ch3 paras", len(lines))

# Table 8 sample formatting
t = doc.tables[7]
print("TABLES", len(doc.tables))
print("T8 rows", len(t.rows), "cols", len(t.columns))
for ri, row in enumerate(t.rows[:3]):
    cells = [c.text.replace("\n", " | ")[:80] for c in row.cells]
    print(ri, cells)

# inspect first table style
print("table style", t.style.name if t.style else None)

# inspect a caption paragraph formatting
for i, p in enumerate(doc.paragraphs):
    if p.text.strip() == "Tabla 8":
        pf = p.paragraph_format
        print("Tabla 8 style", p.style.name)
        print(" align", p.alignment)
        print(" space_before", pf.space_before)
        print(" space_after", pf.space_after)
        print(" line", pf.line_spacing, pf.line_spacing_rule)
        print(" first_indent", pf.first_line_indent)
        for r in p.runs:
            print(" run", r.text, r.bold, r.italic, r.font.name, r.font.size)
        if i+1 < len(doc.paragraphs):
            p2 = doc.paragraphs[i+1]
            print(" next", repr(p2.text[:120]), p2.style.name)
            for r in p2.runs:
                print(" r2", r.text[:80], r.bold, r.italic, r.font.name, r.font.size)
        break

# Chapter heading formatting
for i, p in enumerate(doc.paragraphs):
    if p.text.strip().startswith("Capítulo IV"):
        print("CH4 style", p.style.name, "align", p.alignment)
        pf = p.paragraph_format
        print(" space_before", pf.space_before, "after", pf.space_after)
        print(" first", pf.first_line_indent, "line", pf.line_spacing)
        for r in p.runs:
            print(" run", r.text, r.bold, r.italic, r.font.name, r.font.size, r.font.color.rgb if r.font.color and r.font.color.rgb else None)
        break

# subsection
for i, p in enumerate(doc.paragraphs):
    if "Determinación de requerimientos" in p.text:
        print("SUB style", p.style.name, "align", p.alignment)
        for r in p.runs:
            print(" run", r.text[:60], r.bold, r.italic, r.font.name, r.font.size)
        break

# List paragraph
for i, p in enumerate(doc.paragraphs):
    if p.text.strip().startswith("Determinación"):
        print("idx", i)
        break
