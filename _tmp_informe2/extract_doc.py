import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

path = r"c:\Users\estua\OneDrive\Documents\UMG\10MO\seminario\INFORMES\INFORME II\borrador_INFORME_II_Institucion_Elegida_EORM_Agua_de_la_Mina.docx"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/comments.xml"))
    print("=== COMMENTS ===")
    for c in root.findall(W + "comment"):
        cid = c.get(W + "id")
        author = c.get(W + "author")
        date = c.get(W + "date")
        texts = []
        for t in c.iter(W + "t"):
            if t.text:
                texts.append(t.text)
        print(f"--- ID={cid} | {author} | {date} ---")
        print("".join(texts))
        print()

    doc = ET.fromstring(z.read("word/document.xml"))
    body = doc.find(W + "body")
    print("=== FULL PARAS ===")
    for p in body.iter(W + "p"):
        pPr = p.find(W + "pPr")
        style = ""
        if pPr is not None:
            ps = pPr.find(W + "pStyle")
            if ps is not None:
                style = ps.get(W + "val", "")
        parts = []
        markers = []
        for node in p.iter():
            tname = node.tag.split("}")[-1]
            if tname == "t" and node.text:
                parts.append(node.text)
            elif tname == "tab":
                parts.append("\t")
            elif tname == "commentRangeStart":
                markers.append("START:" + str(node.get(W + "id")))
            elif tname == "commentRangeEnd":
                markers.append("END:" + str(node.get(W + "id")))
            elif tname == "commentReference":
                markers.append("REF:" + str(node.get(W + "id")))
        line = "".join(parts).strip()
        if line or markers:
            m = (" | " + ",".join(markers)) if markers else ""
            s = f"[{style}] " if style else ""
            print(s + line + m)
