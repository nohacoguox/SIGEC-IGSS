# -*- coding: utf-8 -*-
from docx import Document

doc = Document(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_CAPITULO_V.docx")
for i, p in enumerate(doc.paragraphs):
    t = p.text
    if "Mapa mental del proyecto" in t or "Matriz operacional SIGEC" in t:
        print("PARA", i, repr(t[:120]), "style", p.style.name, "nruns", len(p.runs))
        for j, r in enumerate(p.runs):
            print(" ", j, repr(r.text[:80]))
