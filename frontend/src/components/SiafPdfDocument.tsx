import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { formatFechaDMA } from '../utils/dateUtils';

// Alturas calibradas para que la hoja se llene igual que el formato Excel institucional.
const MARGIN = 34;
const FONT_TITLE = 14;
const FONT_FORMA = 10;
const FONT_SECTION = 11;
const FONT_BODY = 10;
const FONT_TABLE = 9;
const FONT_SIGN_LABEL = 8;
const LOGO_HEIGHT = 32;
const ROW_HEIGHT = 21;
const TABLE_RADIUS = 8;
const CONTENT_BLOCK_HEIGHT = 292;
const SUBPRODUCT_CONTENT_HEIGHT = 56;
const TOTAL_ROW_HEIGHT = 16;
const JUSTIFICACION_BOX_HEIGHT = 76;
const FIRMA_BOX_HEIGHT = 62;
const GAP_BETWEEN_SECTIONS = 8;

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
    marginBottom: 8,
  },
  datosUnidadLabel: {
    fontWeight: 'normal',
    marginRight: 6,
    fontSize: FONT_BODY,
  },
  inputLine: {
    borderBottom: '1px solid #000',
    flexGrow: 1,
    minHeight: 14,
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
    marginBottom: 10,
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
    flexDirection: 'column',
    // La línea inferior la aporta el borderTop del encabezado de subproductos
    paddingTop: 2,
    paddingBottom: 2,
  },
  tableItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 5,
  },
  tableItemCodigo: {
    width: '15%',
    paddingHorizontal: 4,
    fontSize: FONT_TABLE,
    textAlign: 'center',
  },
  tableItemDesc: {
    width: '65%',
    paddingHorizontal: 4,
    fontSize: FONT_TABLE,
    textAlign: 'left',
  },
  tableItemCant: {
    width: '20%',
    paddingHorizontal: 4,
    fontSize: FONT_TABLE,
    textAlign: 'center',
  },
  subproductHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    backgroundColor: '#f5f5f5',
  },
  /** Dos columnas 50/50: códigos arriba + Total abajo-derecha | cantidades arriba + total con línea */
  subproductContentBlock: {
    height: SUBPRODUCT_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  subproductColLeft: {
    width: '50%',
    height: '100%',
    flexDirection: 'column',
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 3,
  },
  subproductColRight: {
    width: '50%',
    height: '100%',
    flexDirection: 'column',
    paddingTop: 4,
    paddingBottom: 0,
  },
  subproductCodigo: {
    fontSize: FONT_TABLE,
    textAlign: 'center',
    marginBottom: 2,
  },
  subproductCant: {
    fontSize: FONT_TABLE,
    textAlign: 'center',
    marginBottom: 2,
  },
  subproductTotalLabel: {
    marginTop: 'auto',
    fontSize: FONT_TABLE,
    fontWeight: 'bold',
    textAlign: 'right',
    paddingRight: 6,
  },
  subproductTotalValueBox: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    height: TOTAL_ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subproductTotalValue: {
    fontSize: FONT_TABLE,
    fontWeight: 'bold',
    textAlign: 'center',
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
    paddingVertical: 0,
    paddingHorizontal: 4,
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
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
    paddingHorizontal: 4,
  },
  firmaText: {
    fontSize: 7.5,
    textAlign: 'center',
    lineHeight: 1.15,
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
    marginBottom: 0,
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
          {/* Columnas visuales (solo bordes verticales del bloque) */}
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: '15%', width: 1, backgroundColor: '#000' }} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: '80%', width: 1, backgroundColor: '#000' }} />
          {(data.items || []).map((item, index) => (
            <View key={index} style={styles.tableItemRow} wrap={false}>
              <Text style={styles.tableItemCodigo}>{item.codigo}</Text>
              <Text style={styles.tableItemDesc}>{item.descripcion}</Text>
              <Text style={styles.tableItemCant}>{item.cantidad}</Text>
            </View>
          ))}
          {data.consistentItem ? (
            <View style={styles.tableItemRow} wrap={false}>
              <Text style={styles.tableItemCodigo}> </Text>
              <Text style={[styles.tableItemDesc, styles.consistentItemText]}>
                Consiste en: {data.consistentItem}
              </Text>
              <Text style={styles.tableItemCant}> </Text>
            </View>
          ) : null}
        </View>
        {/* Subproductos: vertical al 50% desde el TOPE del encabezado hasta el fondo */}
        <View style={{ position: 'relative' }}>
          <View style={styles.subproductHeaderRow}>
            <View style={{ width: '50%', padding: 4, justifyContent: 'center' }}>
              <Text style={styles.tableHeaderCell}>Código de Subproducto</Text>
            </View>
            <View style={{ width: '50%', padding: 4, justifyContent: 'center' }}>
              <Text style={styles.tableHeaderCell}>Cantidad por Subproducto</Text>
            </View>
          </View>
          <View style={styles.subproductContentBlock}>
            <View style={styles.subproductColLeft}>
              {(data.subproductos || []).map((sub, index) => (
                <Text key={`c-${index}`} style={styles.subproductCodigo}>
                  {sub.codigo}
                </Text>
              ))}
              <Text style={styles.subproductTotalLabel}>Total</Text>
            </View>
            <View style={styles.subproductColRight}>
              {(data.subproductos || []).map((sub, index) => (
                <Text key={`q-${index}`} style={styles.subproductCant}>
                  {sub.cantidad}
                </Text>
              ))}
              <View style={styles.subproductTotalValueBox}>
                <Text style={styles.subproductTotalValue}>
                  {typeof data.totalSubproductoCantidad === 'number'
                    ? data.totalSubproductoCantidad
                    : (data.subproductos || []).reduce((s, sp) => s + Number(sp.cantidad || 0), 0)}
                </Text>
              </View>
            </View>
          </View>
          {/* Línea encima de todo: del tope del encabezado al fondo (no la tapa el gris) */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              marginLeft: -0.5,
              width: 1,
              backgroundColor: '#000',
            }}
          />
        </View>
      </View>

      {/* 5. FIRMAS: letra pequeña y texto abajo (espacio arriba para firmar) */}
      <View style={[styles.firmasSection, { marginTop: GAP_BETWEEN_SECTIONS }]}>
        <View style={styles.firmaBox}>
          <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
            <Text style={styles.firmaText}>{data.nombreSolicitante}</Text>
            <Text style={styles.firmaText}>{data.puestoSolicitante}</Text>
            <Text style={styles.firmaText}>{data.unidadSolicitante}</Text>
          </View>
        </View>
        <View style={styles.firmaBox}>
          <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
            <Text style={styles.firmaText}>{data.nombreAutoridad}</Text>
            <Text style={styles.firmaText}>{data.puestoAutoridad}</Text>
            <Text style={styles.firmaText}>{data.unidadAutoridad}</Text>
          </View>
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
