# -*- coding: utf-8 -*-
from docx import Document
doc = Document(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\TERCERA_ENTREGA_CAPITULO_V.docx")
for i, p in enumerate(doc.paragraphs):
    if "Mapa mental" in p.text or "Matriz operacional SIGEC" in p.text:
        print(i, p.style.name, p.text[:80].replace("\n"," | "))
