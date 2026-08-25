# -*- coding: utf-8 -*-
"""Extrae solo firma azul + sello IGSS, sin texto tipográfico."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path(
    r"C:\Users\estua\.cursor\projects\c-PROYECTOS-PERSONALES-SIGEC-IGSS\assets"
    r"\c__Users_estua_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"067ede5504a840b3d43caca8d74fd55c_images_image-70484933-538f-4449-aa7b-59428e151cf6.png"
)
OUT_DIR = Path(
    r"C:\Users\estua\Downloads\Capitulo_IV_Ingenieria_de_Requerimientos\instrumentos"
)


def main():
    im = Image.open(SRC).convert("RGBA")
    arr = np.array(im)
    # Quitar "Atentamente,"
    top = int(arr.shape[0] * 0.15)
    arr = arr[top:].copy()
    h, w = arr.shape[:2]

    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    gray = (r.astype(np.int32) + g + b) / 3

    blue = (b > r + 15) & (b > g + 8) & (b > 55) & (r < 210)
    # Cualquier tinta no azul (sello + tipografía)
    ink = (gray < 140) & ~blue

    cx, cy = int(w * 0.735), int(h * 0.40)
    rad = int(min(w, h) * 0.45)
    yy, xx = np.mgrid[:h, :w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    in_stamp = dist <= rad
    ring = in_stamp & (dist >= rad * 0.50)

    # Tipografía digital: negra muy sólida + corridas horizontales largas
    solid = gray < 70
    typed = np.zeros((h, w), dtype=bool)
    for y in range(h):
        row = solid[y] & ~blue[y]
        x = 0
        while x < w:
            if not bool(row[x]):
                x += 1
                continue
            x2 = x
            while x2 < w and bool(row[x2]):
                x2 += 1
            run = x2 - x
            # Letras tipográficas forman corridas; el sello es más irregular
            if run >= 6:
                # Ampliar un poco verticalmente (altura de glifo)
                y0, y1 = max(0, y - 1), min(h, y + 2)
                typed[y0:y1, x:x2] = True
            x = x2

    # Además: rectángulos de las 3 líneas tipográficas conocidas (nombre/cargo/lugar)
    # Coordenadas relativas al recorte (sin Atentamente)
    typed_boxes = [
        (int(w * 0.12), int(h * 0.38), int(w * 0.95), int(h * 0.58)),  # nombre
        (int(w * 0.20), int(h * 0.54), int(w * 0.90), int(h * 0.70)),  # cargo
        (int(w * 0.15), int(h * 0.64), int(w * 0.95), int(h * 0.92)),  # lugar / residual
    ]
    box_mask = np.zeros((h, w), dtype=bool)
    for x0, y0, x1, y1 in typed_boxes:
        box_mask[y0:y1, x0:x1] = True

    # Tipografía a eliminar: (corridas sólidas O cajas) pero NUNCA el anillo del sello
    remove = (typed | (box_mask & ink)) & ~ring & ~blue
    # Fuera del sello, todo lo negro que no sea azul se elimina
    remove |= ink & ~in_stamp & ~blue
    # Debajo del sello: limpiar residual tipográfico
    below_stamp = yy > (cy + rad * 0.55)
    remove |= ink & below_stamp & ~blue & ~ring

    # Conservar: firma azul + tinta del sello (dentro del círculo) menos tipografía
    stamp = ink & in_stamp & ~remove
    keep = blue | stamp | (ink & ring)

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[keep] = arr[keep]
    out[:, :, 3] = np.where(keep, 255, 0)

    # Inpaint simple donde se borró tipografía DENTRO del sello: promedio de vecinos del sello
    holes = remove & in_stamp
    stamp_ref = stamp | (ink & ring)
    filled = out.copy()
    ys, xs = np.where(holes)
    for y, x in zip(ys, xs):
        y0, y1 = max(0, y - 3), min(h, y + 4)
        x0, x1 = max(0, x - 3), min(w, x + 4)
        patch = stamp_ref[y0:y1, x0:x1]
        if not patch.any():
            continue
        vals = arr[y0:y1, x0:x1][patch]
        filled[y, x, :3] = vals[:, :3].mean(axis=0).astype(np.uint8)
        filled[y, x, 3] = 255

    result = Image.fromarray(filled, "RGBA")
    # Suavizar alpha un poco
    alpha = result.split()[-1].filter(ImageFilter.MedianFilter(3))
    result.putalpha(alpha)

    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    pad = 18
    canvas = Image.new("RGBA", (result.width + pad * 2, result.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(result, (pad, pad), result)

    p_trans = OUT_DIR / "firma_sello_solo.png"
    p_white = OUT_DIR / "firma_sello_solo_fondo_blanco.png"
    p_doc = OUT_DIR / "firma_digital_luis_gustavo_sierra.png"
    canvas.save(p_trans)
    canvas.save(p_doc)
    wb = Image.new("RGBA", canvas.size, (255, 255, 255, 255))
    Image.alpha_composite(wb, canvas).save(p_white)
    print(p_trans)
    print(p_white)


if __name__ == "__main__":
    main()
