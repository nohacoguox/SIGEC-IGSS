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
const CONTENT_BLOCK_HEIGHT = 280; // Área de ítems más alta para bajar firmas y justificación
const SUBPRODUCT_CONTENT_HEIGHT = 48;

// Alturas fijas de recuadros
const JUSTIFICACION_BOX_HEIGHT = 52;
const FIRMA_BOX_HEIGHT = 48;
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
        const TOTAL_ROW_HEIGHT = 14; // Fila fina para Total dentro del bloque de subproductos
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
        const lineSpacing = 12;
        const items = siaf.items || [];
        items.forEach((item) => {
          doc.fontSize(FONT_TABLE).font('Helvetica');
          doc.text(String(item.codigo), left + 2, contentY, { width: colCodigo - 4, align: 'center' });
          doc.text(String(item.descripcion || ''), left + colCodigo + 2, contentY, { width: colDesc - 4 });
          doc.text(String(item.cantidad), left + colCodigo + colDesc + 2, contentY, { width: colCant - 4, align: 'center' });
          contentY += lineSpacing;
        });
        if (siaf.consistenteItem) {
          doc.fontSize(FONT_TABLE).font('Helvetica');
          doc.text(`Consiste en: ${siaf.consistenteItem}`, left + colCodigo + 2, contentY, { width: colDesc - 4 });
          contentY += lineSpacing;
        }
        y += CONTENT_BLOCK_HEIGHT;

        // Línea horizontal que separa contenido de subproductos
        doc.moveTo(left, y).lineTo(right, y).stroke();

        // Subproductos: encabezado (Código de Subproducto | Cantidad por Subproducto)
        doc.rect(left, y, colCodigo + colDesc, ROW_HEIGHT).fill('#f5f5f5');
        doc.rect(left + colCodigo + colDesc, y, colCant, ROW_HEIGHT).fill('#f5f5f5');
        doc.rect(left, y, colCodigo + colDesc, ROW_HEIGHT).stroke();
        doc.rect(left + colCodigo + colDesc, y, colCant, ROW_HEIGHT).stroke();
        doc.fillColor('#000').fontSize(FONT_TABLE).font('Helvetica-Bold');
        doc.text('Código de Subproducto', left + 2, y + 5, { width: (colCodigo + colDesc) - 4, align: 'center' });
        doc.text('Cantidad por Subproducto', left + colCodigo + colDesc + 2, y + 5, { width: colCant - 4, align: 'center' });
        y += ROW_HEIGHT;

        // Área de contenido de subproductos: como en la imagen. Izq: celda única con "Total" al fondo. Der: línea horizontal que separa zona de cantidades de la fila fina del total.
        const subproductContentTop = y;
        const tableBottom = tableTop + tableTotalHeight;
        const subTotalY = subproductContentTop + SUBPRODUCT_CONTENT_HEIGHT - TOTAL_ROW_HEIGHT;
        // Vertical: inicio +0.5pt para que el grosor del trazo no sobresalga por encima de la línea horizontal del encabezado; fin -0.5pt para quedar al ras con el borde inferior
        doc.moveTo(left + colCodigo + colDesc, subproductContentTop + 0.5).lineTo(left + colCodigo + colDesc, tableBottom - 0.5).stroke();
        // Línea horizontal solo en la columna derecha: inicio +1 para que el grosor del trazo no invada la columna izquierda
        doc.moveTo(left + colCodigo + colDesc + 1, subTotalY).lineTo(right, subTotalY).stroke();
        const subContentPadding = 4;
        let subContentY = subproductContentTop + subContentPadding;
        subproductos.forEach((sub) => {
          doc.fontSize(FONT_TABLE).font('Helvetica');
          doc.text(String(sub.codigo), left + 2, subContentY, { width: (colCodigo + colDesc) - 4, align: 'center' });
          doc.text(String(sub.cantidad), left + colCodigo + colDesc + 2, subContentY, { width: colCant - 4, align: 'center' });
          subContentY += 12;
        });
        const totalCant = subproductos.reduce((s, sp) => s + Number(sp.cantidad || 0), 0);
        doc.fontSize(FONT_TABLE).font('Helvetica');
        doc.text('Total', left + 2, subTotalY + (TOTAL_ROW_HEIGHT - 8) / 2, { width: (colCodigo + colDesc) - 4, align: 'center' });
        doc.text(String(totalCant), left + colCodigo + colDesc + 2, subTotalY + (TOTAL_ROW_HEIGHT - 8) / 2, { width: colCant - 4, align: 'center' });
        y += SUBPRODUCT_CONTENT_HEIGHT + GAP_BETWEEN_SECTIONS;

        // ----- 5. FIRMAS: primero (como en la imagen de referencia) -----
        const gap = CONTENT_WIDTH - FIRMA_BOX_WIDTH * 2;
        doc.roundedRect(left, y, FIRMA_BOX_WIDTH, FIRMA_BOX_HEIGHT, TABLE_RADIUS).stroke();
        doc.roundedRect(left + FIRMA_BOX_WIDTH + gap, y, FIRMA_BOX_WIDTH, FIRMA_BOX_HEIGHT, TABLE_RADIUS).stroke();

        doc.fontSize(FONT_TABLE).font('Helvetica');
        doc.text(String(siaf.nombreSolicitante || ''), left, y + 6, { width: FIRMA_BOX_WIDTH, align: 'center' });
        doc.text(String(siaf.puestoSolicitante || ''), left, y + 14, { width: FIRMA_BOX_WIDTH, align: 'center' });
        doc.text(String(siaf.unidadSolicitante || ''), left, y + 22, { width: FIRMA_BOX_WIDTH, align: 'center' });

        const rightFirmaX = left + FIRMA_BOX_WIDTH + gap;
        doc.fontSize(FONT_TABLE).font('Helvetica');
        doc.text(String(siaf.nombreAutoridad || ''), rightFirmaX, y + 6, { width: FIRMA_BOX_WIDTH, align: 'center' });
        doc.text(String(siaf.puestoAutoridad || ''), rightFirmaX, y + 14, { width: FIRMA_BOX_WIDTH, align: 'center' });
        doc.text(String(siaf.unidadAutoridad || ''), rightFirmaX, y + 22, { width: FIRMA_BOX_WIDTH, align: 'center' });

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
