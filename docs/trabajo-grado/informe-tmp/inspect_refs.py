# -*- coding: utf-8 -*-
from pathlib import Path
from docx import Document

path = Path(r"c:\Users\estua\OneDrive\Documents\UMG\10MO\pg2\TERCERA ENTREGA\SEGUNDA ENTREGA.docx")
doc = Document(str(path))

# heading 1.1 sample
for i, p in enumerate(doc.paragraphs):
    t = p.text.strip()
    if t.startswith("1.1 ") or t.startswith("1.1.5") or t.startswith("1.2 "):
        print(i, p.style.name, repr(t[:90]))
        for r in p.runs[:3]:
            print("  ", r.bold, r.italic, r.font.name, r.font.size.pt if r.font.size else None, repr(r.text[:50]))
        if i > 200:
            break

# bibliography / referencias
print("\n=== REFS / BIBLIO ===")
for i, p in enumerate(doc.paragraphs):
    t = p.text.strip().lower()
    if "referenc" in t or "bibliograf" in t or t.startswith("apa"):
        print(i, p.style.name, p.text[:100])

# last 15 paras
print("\n=== LAST ===")
for i, p in enumerate(doc.paragraphs[-20:]):
    print(len(doc.paragraphs)-20+i, p.style.name, repr(p.text[:80]))

# table header shading
from lxml import etree
t = doc.tables[7]
cell = t.rows[0].cells[0]
xml = cell._tc.xml
if "shd" in xml:
    idx = xml.find("shd")
    print("\nSHD", xml[idx-80:idx+200])
else:
    print("\nNO SHD in header")
    # print tcPr
    if "tcPr" in xml:
        i0 = xml.find("<w:tcPr")
        print(xml[i0:i0+800])

# cell text font
p = t.rows[0].cells[0].paragraphs[0]
print("header cell para style", p.style.name)
for r in p.paragraphs[0].runs if False else p.runs:
    print(" hrun", r.font.name, r.font.size, r.bold, r.text)
p2 = t.rows[1].cells[0].paragraphs[0]
print("body cell")
for r in p2.runs:
    print(" brun", r.font.name, r.font.size, r.bold, r.text[:40])
