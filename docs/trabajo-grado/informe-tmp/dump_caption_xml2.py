# -*- coding: utf-8 -*-
from docx import Document

doc = Document(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\docs\trabajo-grado\TERCERA_ENTREGA_CAPITULO_V.docx")
p = doc.paragraphs[1100]
xml = p._p.xml
for token in ("SEQ", "instrText", "fldChar", "Figura"):
    print(token, xml.count(token))
# print fld parts
idx = xml.find("instrText")
print("idx", idx)
if "w:t" in xml:
    import re
    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)
    print("texts", texts)
    instr = re.findall(r"instrText[^>]*>([^<]*)", xml)
    print("instr", instr)
