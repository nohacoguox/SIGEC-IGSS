# -*- coding: utf-8 -*-
from docx import Document
path = r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\TERCERA_ENTREGA_CAPITULO_V.docx"
doc = Document(path)
for i, p in enumerate(doc.paragraphs):
    t = p.text.strip()
    if t.startswith("Figura 4") and i < 200:
        print(i, repr(t[:110]))
    if "Mapa mental" in t or "Matriz operacional" in t:
        print("BODY/IDX", i, p.style.name, repr(t[:90]))
