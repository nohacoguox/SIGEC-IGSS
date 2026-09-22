# -*- coding: utf-8 -*-
"""Renumerar figuras de anexo 23/24 → 45/46 en el cuerpo del documento."""
from pathlib import Path
from docx import Document

paths = [
    Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_CAPITULO_V.docx"),
    Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\TERCERA_ENTREGA_CAPITULO_V.docx"),
]

src = paths[0]
doc = Document(str(src))
changed = 0
for p in doc.paragraphs:
    t = p.text
    if "Mapa mental del proyecto SIGEC-IGSS" in t and "Figura 23" in t:
        for r in p.runs:
            if "Figura 23" in r.text:
                r.text = r.text.replace("Figura 23", "Figura 45")
                changed += 1
    if "Matriz operacional SIGEC-IGSS" in t and "Figura 24" in t:
        for r in p.runs:
            if "Figura 24" in r.text:
                r.text = r.text.replace("Figura 24", "Figura 46")
                changed += 1
print("runs changed", changed)
doc.save(str(src))
for dest in paths[1:]:
    try:
        doc.save(str(dest))
        print("saved", dest)
    except Exception as e:
        print("skip", dest, e)
