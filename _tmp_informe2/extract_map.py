# -*- coding: utf-8 -*-
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

path = r"c:\Users\estua\OneDrive\Documents\UMG\10MO\seminario\INFORMES\INFORME II\borrador_INFORME_II_Institucion_Elegida_EORM_Agua_de_la_Mina.docx"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
out = Path(r"c:\PROYECTOS-PERSONALES\SIGEC-IGSS\_tmp_informe2\extract_out.txt")

lines = []

with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/comments.xml"))
    comments = {}
    for c in root.findall(W + "comment"):
        cid = c.get(W + "id")
        texts = []
        for t in c.iter(W + "t"):
            if t.text:
                texts.append(t.text)
        comments[cid] = "".join(texts)

    doc = ET.fromstring(z.read("word/document.xml"))
    body = doc.find(W + "body")

    # Map comment id -> annotated text
    annotated = {cid: [] for cid in comments}
    active = set()
    for node in body.iter():
        tname = node.tag.split("}")[-1]
        if tname == "commentRangeStart":
            active.add(node.get(W + "id"))
        elif tname == "commentRangeEnd":
            active.discard(node.get(W + "id"))
        elif tname == "t" and node.text and active:
            for cid in active:
                annotated[cid].append(node.text)

    lines.append("=== COMMENT -> ANCHOR TEXT ===")
    for cid in sorted(comments.keys(), key=lambda x: int(x)):
        anchor = "".join(annotated.get(cid, [])).strip()
        lines.append(f"ID={cid}")
        lines.append(f"ANCHOR: {anchor[:300]}")
        lines.append(f"COMMENT: {comments[cid]}")
        lines.append("")

    lines.append("=== FULL TEXT ===")
    for p in body.iter(W + "p"):
        parts = []
        for node in p.iter():
            tname = node.tag.split("}")[-1]
            if tname == "t" and node.text:
                parts.append(node.text)
            elif tname == "tab":
                parts.append("\t")
        line = "".join(parts).strip()
        if line:
            lines.append(line)

out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out} ({len(lines)} lines)")
print("Comments:", len(comments))
for cid in sorted(comments.keys(), key=lambda x: int(x)):
    print(f"  {cid}: {comments[cid][:80]}")
