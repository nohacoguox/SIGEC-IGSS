import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { formatFechaDMA } from '../utils/dateUtils';

// Contenido más abajo para ocupar espacio en blanco (1 hoja)
const MARGIN = 38;
const FONT_TITLE = 14;
const FONT_FORMA = 10;
const FONT_SECTION = 11;
const FONT_BODY = 10;
const FONT_TABLE = 9;
const FONT_SIGN_LABEL = 8;
const LOGO_HEIGHT = 38;
const ROW_HEIGHT = 16;
const TABLE_RADIUS = 8;
const CONTENT_BLOCK_HEIGHT = 280;
const SUBPRODUCT_CONTENT_HEIGHT = 48;
const TOTAL_ROW_HEIGHT = 14;
const JUSTIFICACION_BOX_HEIGHT = 52;
const FIRMA_BOX_HEIGHT = 48;
const GAP_BETWEEN_SECTIONS = 10;

export interface SiafPdfDocumentProps {
  data: {
    fecha: string;
    correlativo: string;
    nombreUnidad: string;
    direccion: string;
    justificacion: string;
    items: { codigo: string; descripcion: string; cantidad: number }[];
    subproductos: { codigo: string; cantidad: number }[];
    totalSubproductoCantidad: number;
    nombreSolicitante: string;
    puestoSolicitante: string;
    unidadSolicitante: string;
    nombreAutoridad: string;
    puestoAutoridad: string;
    unidadAutoridad: string;
    areaUnidad: string;
    consistentItem?: string;
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: FONT_BODY,
    paddingTop: MARGIN,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
    paddingBottom: MARGIN,
    color: '#000',
  },
  // Encabezado: recuadro con bordes curvos (como 2da imagen), logo a la izquierda
  header: {
    flexDirection: 'column',
    height: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    border: '1px solid #000',
    borderRadius: 8,
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerRightForForma: {
    alignItems: 'flex-end',
  },
  headerRow2: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: LOGO_HEIGHT,
    marginRight: 0,
  },
  headerTitle: {
    fontSize: FONT_TITLE,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerFormaText: {
    fontSize: FONT_FORMA,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  datosUnidadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  datosUnidadLabel: {
    fontWeight: 'normal',
    marginRight: 6,
    fontSize: FONT_BODY,
  },
  inputLine: {
    borderBottom: '1px solid #000',
    flexGrow: 1,
    minHeight: 12,
  },
  datosUnidadTitle: {
    marginVertical: 4,
    fontWeight: 'bold',
    fontSize: FONT_SECTION,
  },
  datosUnidadBox: {
    border: '1px solid #000',
    borderRadius: 8,
    padding: 8,
    marginTop: GAP_BETWEEN_SECTIONS,
  },
  fullWidthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
    width: '100%',
  },
  // Tabla: recuadro con bordes curvos; área de contenido altura fija sin líneas horizontales
  tableContainer: {
    width: '100%',
    marginBottom: 0,
    flexDirection: 'column',
    border: '1px solid #000',
    borderRadius: TABLE_RADIUS,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderBottom: '1px solid #000',
    backgroundColor: '#f5f5f5',
  },
  tableContentBlock: {
    height: CONTENT_BLOCK_HEIGHT,
    flexDirection: 'row',
    borderBottom: '1px solid #000',
  },
  subproductHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderBottom: '1px solid #000',
    backgroundColor: '#f5f5f5',
  },
  subproductContentBlock: {
    height: SUBPRODUCT_CONTENT_HEIGHT,
    flexDirection: 'row',
  },
  tableContentCol: {
    padding: 4,
    borderRight: '1px solid #000',
  },
  tableContentColLast: {
    padding: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: ROW_HEIGHT,
  },
  tableHeaderCell: {
    padding: 4,
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
    color: '#000',
  },
  tableDataCell: {
    padding: 2,
    fontSize: FONT_TABLE,
    textAlign: 'center',
  },
  consistentItemText: {
    fontSize: FONT_TABLE,
    fontWeight: 'normal',
  },
  contentBlockText: {
    fontSize: FONT_TABLE,
    marginBottom: 4,
  },
  firmasSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  firmaBox: {
    width: '48%',
    height: FIRMA_BOX_HEIGHT,
    border: '1px solid #000',
    borderRadius: TABLE_RADIUS,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  firmaText: {
    fontSize: FONT_TABLE,
    textAlign: 'center',
  },
  firmaLabel: {
    fontSize: FONT_SIGN_LABEL,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 2,
  },
  justificacionSection: {
    height: JUSTIFICACION_BOX_HEIGHT,
    border: '1px solid #000',
    borderRadius: TABLE_RADIUS,
    padding: 6,
    marginBottom: GAP_BETWEEN_SECTIONS,
  },
  justificacionTitle: {
    fontWeight: 'bold',
    fontSize: FONT_BODY,
    marginBottom: 2,
  },
  justificacionText: {
    fontSize: FONT_TABLE,
    lineHeight: 1.35,
    textAlign: 'justify',
  },
});

export const SiafPdfDocument: React.FC<SiafPdfDocumentProps> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* 1. ENCABEZADO: sin recuadro */}
      <View style={styles.header} fixed>
        <View style={styles.headerRow1}>
          <View style={styles.headerLeft}>
            <Image style={styles.logo} src={`${window.location.origin}/images/logoIgss.png`} />
          </View>
          <View style={styles.headerRightForForma}>
            <Text style={styles.headerFormaText}>FORMA: A-01 SIAF</Text>
          </View>
        </View>
        <View style={styles.headerRow2}>
          <Text style={styles.headerTitle}>SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS</Text>
        </View>
      </View>

      {/* 2 y 3. Fecha, Correlativo + DATOS DE LA UNIDAD: recuadro con bordes curvos */}
      <View style={styles.datosUnidadBox}>
        <View style={styles.datosUnidadRow}>
          <View style={{ flexDirection: 'row', width: '50%' }}>
            <Text style={styles.datosUnidadLabel}>Fecha:</Text>
            <Text style={styles.inputLine}>{formatFechaDMA(data.fecha)}</Text>
          </View>
          <View style={{ flexDirection: 'row', width: '45%', justifyContent: 'flex-end' }}>
            <Text style={styles.datosUnidadLabel}>Correlativo No.</Text>
            <Text style={styles.inputLine}>{data.correlativo}</Text>
          </View>
        </View>
        <Text style={styles.datosUnidadTitle}>DATOS DE LA UNIDAD EJECUTORA, CENTRO DE COSTO, DEPENDENCIA O SERVICIO</Text>
        <View style={styles.fullWidthRow}>
          <Text style={{ ...styles.datosUnidadLabel, width: 52 }}>Nombre:</Text>
          <Text style={styles.inputLine}>{data.nombreUnidad}{data.areaUnidad ? ` / ${data.areaUnidad}` : ''}</Text>
        </View>
        <View style={styles.fullWidthRow}>
          <Text style={{ ...styles.datosUnidadLabel, width: 52 }}>Dirección:</Text>
          <Text style={styles.inputLine}>{data.direccion}</Text>
        </View>
      </View>

      {/* 4. TABLA: bordes curvos; área de contenido altura fija sin líneas horizontales */}
      <View style={[styles.tableContainer, { marginTop: GAP_BETWEEN_SECTIONS }]}>
        <View style={styles.tableHeaderRow}>
          <View style={[styles.tableContentCol, { width: '15%', justifyContent: 'center' }]}>
            <Text style={styles.tableHeaderCell}>Código</Text>
          </View>
          <View style={[styles.tableContentCol, { width: '65%', justifyContent: 'center' }]}>
            <Text style={styles.tableHeaderCell}>Descripción</Text>
          </View>
          <View style={[styles.tableContentColLast, { width: '20%', justifyContent: 'center' }]}>
            <Text style={styles.tableHeaderCell}>Cantidad</Text>
          </View>
        </View>
        <View style={styles.tableContentBlock}>
          <View style={[styles.tableContentCol, { width: '15%' }]}>
            {(data.items || []).map((item, index) => (
              <Text key={index} style={[styles.contentBlockText, { textAlign: 'center' }]}>{item.codigo}</Text>
            ))}
          </View>
          <View style={[styles.tableContentCol, { width: '65%' }]}>
            {(data.items || []).map((item, index) => (
              <Text key={index} style={[styles.contentBlockText, { textAlign: 'left' }]}>{item.descripcion}</Text>
            ))}
            {data.consistentItem && (
              <Text style={[styles.contentBlockText, styles.consistentItemText, { textAlign: 'left' }]}>Consiste en: {data.consistentItem}</Text>
            )}
          </View>
          <View style={[styles.tableContentColLast, { width: '20%' }]}>
            {(data.items || []).map((item, index) => (
              <Text key={index} style={[styles.contentBlockText, { textAlign: 'center' }]}>{item.cantidad}</Text>
            ))}
          </View>
        </View>
        <View style={styles.subproductHeaderRow}>
          <View style={[styles.tableContentCol, { width: '50%', justifyContent: 'center' }]}>
            <Text style={styles.tableHeaderCell}>Código de Subproducto</Text>
          </View>
          <View style={[styles.tableContentColLast, { width: '50%', justifyContent: 'center' }]}>
            <Text style={styles.tableHeaderCell}>Cantidad por Subproducto</Text>
          </View>
        </View>
        <View style={styles.subproductContentBlock}>
          <View style={[styles.tableContentCol, { width: '50%', justifyContent: 'space-between' }]}>
            <View>
              {(data.subproductos || []).map((sub, index) => (
                <Text key={index} style={[styles.contentBlockText, { textAlign: 'center' }]}>{sub.codigo}</Text>
              ))}
            </View>
            <Text style={[styles.tableDataCell, { textAlign: 'center' }]}>Total</Text>
          </View>
          <View style={[styles.tableContentColLast, { width: '50%', flex: 1, justifyContent: 'space-between', overflow: 'hidden' }]}>
            <View>
              {(data.subproductos || []).map((sub, index) => (
                <Text key={index} style={[styles.contentBlockText, { textAlign: 'center' }]}>{sub.cantidad}</Text>
              ))}
            </View>
            <View style={{ borderTop: '1px solid #000', height: TOTAL_ROW_HEIGHT, justifyContent: 'center' }}>
              <Text style={[styles.tableDataCell, { textAlign: 'center' }]}>
                {(data.subproductos || []).reduce((s, sp) => s + Number(sp.cantidad || 0), 0)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. FIRMAS: primero (como en la imagen) */}
      <View style={[styles.firmasSection, { marginTop: GAP_BETWEEN_SECTIONS }]}>
        <View style={styles.firmaBox}>
          <Text style={styles.firmaText}>{data.nombreSolicitante}</Text>
          <Text style={styles.firmaText}>{data.puestoSolicitante}</Text>
          <Text style={styles.firmaText}>{data.unidadSolicitante}</Text>
        </View>
        <View style={styles.firmaBox}>
          <Text style={styles.firmaText}>{data.nombreAutoridad}</Text>
          <Text style={styles.firmaText}>{data.puestoAutoridad}</Text>
          <Text style={styles.firmaText}>{data.unidadAutoridad}</Text>
        </View>
      </View>

      {/* 6. JUSTIFICACIÓN: de último */}
      <View style={{ marginTop: GAP_BETWEEN_SECTIONS }}>
        <View style={styles.justificacionSection}>
          <Text style={styles.justificacionTitle}>JUSTIFICACIÓN:</Text>
          <Text style={styles.justificacionText}>{data.justificacion}</Text>
        </View>
      </View>
    </Page>
  </Document>
);
