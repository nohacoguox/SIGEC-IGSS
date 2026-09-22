# -*- coding: utf-8 -*-
from docx import Document

doc = Document(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_CAPITULO_V.docx")
p = doc.paragraphs[1100]
xml = p._p.xml
print(xml[:2500])
