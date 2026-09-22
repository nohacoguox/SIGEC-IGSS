# -*- coding: utf-8 -*-
from pathlib import Path
from docx import Document

path = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\TERCERA_ENTREGA_CAPITULO_V.docx")
doc = Document(str(path))

# headings and chapter 5
for i, p in enumerate(doc.paragraphs):
    t = p.text.strip()
    if not t:
        continue
    low = t.lower()
    keep = (
        t.startswith(("5.", "Capítulo V", "Capitulo V", "Conclus"))
        or "program" in low
        or "componente" in low
        or t.startswith(("Tabla 3", "Tabla 4", "Figura 4"))
        or "diseño de la solución" in low
        or "modulo" in low
        or "módulo" in low and t.startswith("5")
    )
    if keep:
        print(f"{i:04d} [{p.style.name}] {t[:160]}")
