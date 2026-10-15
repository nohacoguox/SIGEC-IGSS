import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { SiafSolicitud } from '../entity/SiafSolicitud';

// Dimensiones: 1 hoja LETTER, contenido más abajo para ocupar espacio en blanco
const MARGIN_TOP = 38;
const MARGIN_SIDES = 36;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_SIDES * 2;
const FONT_TITLE = 14;
const FONT_FORMA = 11;
const FONT_SECTION = 11;
const FONT_IGSS_LINE1 = 7;
const FONT_IGSS_LINE2 = 11;
const COLOR_IGSS_BLUE = '#1E88C2';
const COLOR_IGSS_TURQUOISE = '#0D7A6E';
const FONT_BODY = 10;
const FONT_TABLE = 9;
const FONT_SIGN_LABEL = 8;
const LOGO_HEIGHT = 38;
const ROW_HEIGHT = 16;
const TABLE_RADIUS = 8;
const CONTENT_BLOCK_HEIGHT = 292; // Área de ítems (tope antes de subproductos); alineado con SiafPdfDocument
const SUBPRODUCT_CONTENT_HEIGHT = 56; // Alineado con SiafPdfDocument (incluye fila Total)

// Alturas fijas de recuadros
const JUSTIFICACION_BOX_HEIGHT = 52;
const FIRMA_BOX_HEIGHT = 62; // Espacio superior para firma manuscrita; texto abajo
const FIRMA_BOX_WIDTH = CONTENT_WIDTH * 0.48;
const GAP_BETWEEN_SECTIONS = 10;

export class PdfGeneratorService {
  private getLogoPath(): string | null {
    const candidates = [
      path.join(__dirname, '..', '..', 'assets', 'logo-igss.png'),
      path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'images', 'logoIgss.png'),
      path.join(process.cwd(), 'assets', 'logo-igss.png'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Genera un PDF idéntico al formato oficial SIAF-A-01: solo las líneas del original, recuadros con tamaño exacto, espacios en blanco respetados.
   */
  async generateSiafPdf(siaf: SiafSolicitud): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const left = MARGIN_SIDES;
        const right = PAGE_WIDTH - MARGIN_SIDES;
        let y = MARGIN_TOP;

        // ----- 1. ENCABEZADO (réplica exacta: borde redondeado, logo+texto IGSS izquierda, título centro, FORMA arriba derecha) -----
        const HEADER_BOX_HEIGHT = 50;
        const HEADER_RADIUS = 8;
        const headerPadding = 10;
        const LOGO_EMBLEM_WIDTH = 48;
        const LOGO_GAP = 6;
        const FORMA_WIDTH = 100;
        const LEFT_ZONE_TEXT_WIDTH = 95;

        // Borde: rectángulo horizontal con esquinas redondeadas, borde negro, fondo blanco
        doc.roundedRect(left, y, CONTENT_WIDTH, HEADER_BOX_HEIGHT, HEADER_RADIUS).stroke();

        doc.save();
        doc.roundedRect(left, y, CONTENT_WIDTH, HEADER_BOX_HEIGHT, HEADER_RADIUS).clip();

        const logoX = left + headerPadding;
        const logoY = y + (HEADER_BOX_HEIGHT - LOGO_HEIGHT) / 2;
        const logoPath = this.getLogoPath();
        if (logoPath) {
          try {
            doc.image(logoPath, logoX, logoY, {
              height: LOGO_HEIGHT,
              width: LOGO_EMBLEM_WIDTH,
              fit: [LOGO_EMBLEM_WIDTH, LOGO_HEIGHT],
            });
          } catch (_) {}
        }

        // Texto institucional a la derecha del emblema: "Instituto Guatemalteco de" (pequeño, azul) y "Seguridad Social" (grande, negrita, turquesa)
        const textLogoX = logoX + LOGO_EMBLEM_WIDTH + LOGO_GAP;
        doc.fontSize(FONT_IGSS_LINE1).font('Helvetica').fillColor(COLOR_IGSS_BLUE);
        doc.text('Instituto Guatemalteco de', textLogoX, y + 10, { width: LEFT_ZONE_TEXT_WIDTH });
        doc.fontSize(FONT_IGSS_LINE2).font('Helvetica-Bold').fillColor(COLOR_IGSS_TURQUOISE);
        doc.text('Seguridad Social', textLogoX, y + 22, { width: LEFT_ZONE_TEXT_WIDTH });

        const leftZoneEnd = textLogoX + LEFT_ZONE_TEXT_WIDTH + 4;
        const rightFormaStart = right - headerPadding - FORMA_WIDTH;

        // Título centrado en el espacio entre bloque logo y FORMA; alineado verticalmente con el logo
        doc.fontSize(FONT_TITLE).font('Helvetica-Bold').fillColor('#000');
        doc.text('SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS', leftZoneEnd, y + (HEADER_BOX_HEIGHT - 14) / 2 + 2, {
          width: rightFormaStart - leftZoneEnd,
          align: 'center',
        });

        // FORMA: arriba a la derecha, alineado con la parte superior del título
        doc.fontSize(FONT_FORMA).font('Helvetica-Bold').fillColor('#000');
        doc.text('FORMA: A-01 SIAF', right - headerPadding - FORMA_WIDTH, y + 10, { width: FORMA_WIDTH, align: 'right' });

        doc.restore();
        y += HEADER_BOX_HEIGHT + GAP_BETWEEN_SECTIONS;

        // ----- 2 y 3. Fecha, Correlativo + DATOS DE LA UNIDAD: un solo recuadro con bordes curvos -----
        const datosUnidadTop = y;
        const datosUnidadPadding = 8;
        const datosUnidadRadius = 8;
        y += datosUnidadPadding;

        doc.fontSize(FONT_BODY).font('Helvetica').fillColor('#000');
        doc.text('Fecha:', left + datosUnidadPadding, y + 2);
        const fechaStr = siaf.fecha ? new Date(siaf.fecha).toLocaleDateString('es-GT') : 'N/A';
        doc.text(fechaStr, left + datosUnidadPadding + 36, y + 2, { width: 140 });
        doc.text('Correlativo No.', right - datosUnidadPadding - 165, y + 2, { width: 90 });
        doc.text(String(siaf.correlativo || 'N/A'), right - datosUnidadPadding - 65, y + 2, { width: 65, align: 'right' });
        y += 18;

        doc.fontSize(FONT_SECTION).font('Helvetica-Bold');
        doc.text('DATOS DE LA UNIDAD EJECUTORA, CENTRO DE COSTO, DEPENDENCIA O SERVICIO', left + datosUnidadPadding, y + 2, { width: CONTENT_WIDTH - datosUnidadPadding * 2 });
        y += 16;
        doc.fontSize(FONT_BODY).font('Helvetica');
        doc.text('Nombre:', left + datosUnidadPadding, y + 2);
        const areaNombre = siaf.area?.nombre ? ` / ${siaf.area.nombre}` : '';
        doc.text(String(siaf.nombreUnidad || '') + areaNombre, left + datosUnidadPadding + 46, y + 2, { width: CONTENT_WIDTH - 52 - datosUnidadPadding * 2 });
        y += 14;
        doc.text('Dirección:', left + datosUnidadPadding, y + 2);
        doc.text(String(siaf.direccion || 'N/A'), left + datosUnidadPadding + 50, y + 2, { width: CONTENT_WIDTH - 54 - datosUnidadPadding * 2 });
        y += 18 + datosUnidadPadding;

        const datosUnidadBoxHeight = y - datosUnidadTop;
        doc.roundedRect(left, datosUnidadTop, CONTENT_WIDTH, datosUnidadBoxHeight, datosUnidadRadius).stroke();
        y += GAP_BETWEEN_SECTIONS;

        // ----- 4. TABLA: recuadro con bordes curvos; área de contenido altura fija SIN líneas horizontales -----
        const colCodigo = 0.15 * CONTENT_WIDTH;
        const colDesc = 0.65 * CONTENT_WIDTH;
        const colCant = 0.20 * CONTENT_WIDTH;
        const subproductos = siaf.subproductos || [];
        const TOTAL_ROW_HEIGHT = 16; // Fila Total; alineado con SiafPdfDocument
        const tableTotalHeight = ROW_HEIGHT + CONTENT_BLOCK_HEIGHT + ROW_HEIGHT + ROW_HEIGHT + SUBPRODUCT_CONTENT_HEIGHT;
        const tableTop = y;

        doc.roundedRect(left, tableTop, CONTENT_WIDTH, tableTotalHeight, TABLE_RADIUS).stroke();

        // Fila encabezado (Código, Descripción, Cantidad) con fondo gris claro para destacar títulos
        doc.rect(left, y, colCodigo, ROW_HEIGHT).fill('#f5f5f5');
        doc.rect(left + colCodigo, y, colDesc, ROW_HEIGHT).fill('#f5f5f5');
        doc.rect(left + colCodigo + colDesc, y, colCant, ROW_HEIGHT).fill('#f5f5f5');
        doc.rect(left, y, colCodigo, ROW_HEIGHT).stroke();
        doc.rect(left + colCodigo, y, colDesc, ROW_HEIGHT).stroke();
        doc.rect(left + colCodigo + colDesc, y, colCant, ROW_HEIGHT).stroke();
        doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
        doc.text('Código', left + 2, y + 5, { width: colCodigo - 4, align: 'center' });
        doc.text('Descripción', left + colCodigo + 2, y + 5, { width: colDesc - 4, align: 'center' });
        doc.text('Cantidad', left + colCodigo + colDesc + 2, y + 5, { width: colCant - 4, align: 'center' });
        y += ROW_HEIGHT;

        // Área de contenido: altura fija, solo líneas verticales (sin horizontales). Items + "Consiste en" dentro.
        const contentTop = y;
        doc.moveTo(left + colCodigo, contentTop).lineTo(left + colCodigo, contentTop + CONTENT_BLOCK_HEIGHT).stroke();
        doc.moveTo(left + colCodigo + colDesc, contentTop).lineTo(left + colCodigo + colDesc, contentTop + CONTENT_BLOCK_HEIGHT).stroke();
        const contentPadding = 4;
        let contentY = contentTop + contentPadding;
        const contentBottom = contentTop + CONTENT_BLOCK_HEIGHT - contentPadding;
        const rowGap = 5;
        const items = siaf.items || [];
        items.forEach((item) => {
          doc.fontSize(FONT_TABLE).font('Helvetica');
          const desc = String(item.descripcion || '');
          const descHeight = Math.max(
            FONT_TABLE + 2,
            doc.heightOfString(desc, { width: colDesc - 4 })
          );
          if (contentY + descHeight > contentBottom) return;
          // Misma Y para código, descripción y cantidad → fila alineada
          doc.text(String(item.codigo ?? ''), left + 2, contentY, {
            width: colCodigo - 4,
            align: 'center',
            lineBreak: false,
          });
          doc.text(desc, left + colCodigo + 2, contentY, { width: colDesc - 4 });
          doc.text(String(item.cantidad ?? ''), left + colCodigo + colDesc + 2, contentY, {
            width: colCant - 4,
            align: 'center',
            lineBreak: false,
          });
          contentY += descHeight + rowGap;
        });
        if (siaf.consistenteItem) {
          doc.fontSize(FONT_TABLE).font('Helvetica');
          const consistente = `Consiste en: ${siaf.consistenteItem}`;
          const h = Math.max(
            FONT_TABLE + 2,
            doc.heightOfString(consistente, { width: colDesc - 4 })
          );
          if (contentY + h <= contentBottom) {
            doc.text(consistente, left + colCodigo + 2, contentY, { width: colDesc - 4 });
            contentY += h + rowGap;
          }
        }
        y += CONTENT_BLOCK_HEIGHT;

        // Subproductos: 50% | 50% (Total sin línea izq.; línea solo en cantidad)
        const subColW = CONTENT_WIDTH / 2;
        const midX = left + subColW;
        const subHeaderTop = y;
        const tableBottom = tableTop + tableTotalHeight;

        // Fondo gris del encabezado
        doc.save();
        doc.fillColor('#f5f5f5').rect(left, subHeaderTop, CONTENT_WIDTH, ROW_HEIGHT).fill();
        doc.restore();

        doc.fillColor('#000').fontSize(FONT_TABLE).font('Helvetica-Bold');
        doc.text('Código de Subproducto', left + 2, subHeaderTop + 5, { width: subColW - 4, align: 'center' });
        doc.text('Cantidad por Subproducto', midX + 2, subHeaderTop + 5, { width: subColW - 4, align: 'center' });
        y = subHeaderTop + ROW_HEIGHT;

        const subproductContentTop = y;
        const subTotalY = subproductContentTop + SUBPRODUCT_CONTENT_HEIGHT - TOTAL_ROW_HEIGHT;

        const subContentPadding = 4;
        let subContentY = subproductContentTop + subContentPadding;
        subproductos.forEach((sub) => {
          if (subContentY + 11 > subTotalY) return;
          doc.fontSize(FONT_TABLE).font('Helvetica');
          doc.text(String(sub.codigo), left + 2, subContentY, { width: subColW - 4, align: 'center' });
          doc.text(String(sub.cantidad), midX + 2, subContentY, { width: subColW - 4, align: 'center' });
          subContentY += 11;
        });
        const totalCant = subproductos.reduce((s, sp) => s + Number(sp.cantidad || 0), 0);
        doc.fontSize(FONT_TABLE).font('Helvetica-Bold');
        doc.text('Total', left + 2, subTotalY + (TOTAL_ROW_HEIGHT - 8) / 2, {
          width: subColW - 8,
          align: 'right',
        });
        doc.text(String(totalCant), midX + 2, subTotalY + (TOTAL_ROW_HEIGHT - 8) / 2, {
          width: subColW - 4,
          align: 'center',
        });

        // Trazos AL FINAL (encima del gris/texto): vertical del TOPE del encabezado al fondo
        doc.save();
        doc.strokeColor('#000').lineWidth(1);
        doc.moveTo(left, subHeaderTop).lineTo(right, subHeaderTop).stroke();
        doc.moveTo(left, subHeaderTop + ROW_HEIGHT).lineTo(right, subHeaderTop + ROW_HEIGHT).stroke();
        doc.moveTo(midX, subHeaderTop).lineTo(midX, tableBottom).stroke();
        doc.moveTo(midX, subTotalY).lineTo(right, subTotalY).stroke();
        doc.restore();

        y += SUBPRODUCT_CONTENT_HEIGHT + GAP_BETWEEN_SECTIONS;

        // ----- 5. FIRMAS: texto abajo; espacio libre arriba para firmar -----
        const gap = CONTENT_WIDTH - FIRMA_BOX_WIDTH * 2;
        doc.roundedRect(left, y, FIRMA_BOX_WIDTH, FIRMA_BOX_HEIGHT, TABLE_RADIUS).stroke();
        doc.roundedRect(left + FIRMA_BOX_WIDTH + gap, y, FIRMA_BOX_WIDTH, FIRMA_BOX_HEIGHT, TABLE_RADIUS).stroke();

        const firmaFontSize = 7.5;
        const firmaLineH = 9;
        const firmaTextBottomPad = 5;
        const firmaTextStartY = y + FIRMA_BOX_HEIGHT - firmaTextBottomPad - firmaLineH * 3;
        doc.fontSize(firmaFontSize).font('Helvetica');
        doc.text(String(siaf.nombreSolicitante || ''), left, firmaTextStartY, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });
        doc.text(String(siaf.puestoSolicitante || ''), left, firmaTextStartY + firmaLineH, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });
        doc.text(String(siaf.unidadSolicitante || ''), left, firmaTextStartY + firmaLineH * 2, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });

        const rightFirmaX = left + FIRMA_BOX_WIDTH + gap;
        doc.text(String(siaf.nombreAutoridad || ''), rightFirmaX, firmaTextStartY, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });
        doc.text(String(siaf.puestoAutoridad || ''), rightFirmaX, firmaTextStartY + firmaLineH, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });
        doc.text(String(siaf.unidadAutoridad || ''), rightFirmaX, firmaTextStartY + firmaLineH * 2, {
          width: FIRMA_BOX_WIDTH,
          align: 'center',
          lineBreak: false,
        });

        y += FIRMA_BOX_HEIGHT + GAP_BETWEEN_SECTIONS;

        // ----- 6. JUSTIFICACIÓN: de último -----
        doc.roundedRect(left, y, CONTENT_WIDTH, JUSTIFICACION_BOX_HEIGHT, TABLE_RADIUS).stroke();
        doc.fontSize(FONT_BODY).font('Helvetica-Bold');
        doc.text('JUSTIFICACIÓN:', left + 6, y + 8);
        doc.fontSize(FONT_TABLE).font('Helvetica');
        doc.text(String(siaf.justificacion || ''), left + 6, y + 22, { width: CONTENT_WIDTH - 12, align: 'justify' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const pdfGeneratorService = new PdfGeneratorService();
