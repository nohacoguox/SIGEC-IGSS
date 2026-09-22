# -*- coding: utf-8 -*-
"""Extrae párrafos clave para actualizar Introducción y Conclusiones."""
from pathlib import Path
from docx import Document

doc = Document(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\SEGUNDA_ENTREGA_BASE.docx")
out = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\informe-tmp\intro_conc.txt")
lines = []
for i, p in enumerate(doc.paragraphs):
    t = p.text.strip()
    if i in (133, 134, 135, 136, 137, 883, 884, 885, 886) or t in ("Introducción", "Conclusiones"):
        lines.append(f"--- {i} ---")
        lines.append(p.text)
        lines.append("")
out.write_text("\n".join(lines), encoding="utf-8")
print("ok")
