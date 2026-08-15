/**
 * Visor PDF con PDF.js (Mozilla): detecta página y posición exacta del clic
 * para marcar correcciones/rechazos y mostrar pins en el mismo punto.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import * as pdfjsLib from 'pdfjs-dist';

const PDFJS_VERSION = '4.10.38';
if (typeof window !== 'undefined') {
  const g = (pdfjsLib as any).GlobalWorkerOptions;
  if (g && !g.workerSrc) {
    g.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  }
}

export type PdfMarker = {
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  /** Número o texto visible en el pin (ej. 1, 2, 3) */
  label?: string | number;
  /** Resalta el pin seleccionado */
  active?: boolean;
};

type PdfViewerWithClickProps = {
  /** URL del PDF (blob URL o URL absoluta) */
  fileUrl: string;
  /** Si true, habilita clic derecho para señalar (onContextMenuOnPage se llamará) */
  enableContextMenu?: boolean;
  /** Si true, habilita clic izquierdo para colocar marca (onClickOnPage) */
  enableClickMark?: boolean;
  /** Callback: (pageNumber, xPercent, yPercent, event) respecto a la página donde hizo clic */
  onContextMenuOnPage?: (pageNumber: number, xPercent: number, yPercent: number, event: React.MouseEvent) => void;
  /** Callback de clic izquierdo en modo marcar */
  onClickOnPage?: (pageNumber: number, xPercent: number, yPercent: number, event: React.MouseEvent) => void;
  /** Marca opcional: muestra un pin en esta página en esta posición (para "Ver marca") */
  marker?: PdfMarker | null;
  /** Varias marcas: muestra un pin por cada una */
  markers?: PdfMarker[] | null;
  /** Clase o estilos del contenedor */
  className?: string;
  /** Altura mínima del contenedor */
  minHeight?: number;
  /** Si true y hay marker, solo se renderiza la página del marcador (ahorra carga) */
  markerPageOnly?: boolean;
  /** Nivel de zoom (1 = 100%, 1.5 = 150%, etc.) */
  zoom?: number;
};

const BASE_SCALE = 1.5;

function buildPinHtml(m: PdfMarker): string {
  const label = m.label != null && String(m.label).length > 0 ? String(m.label) : '';
  const ring = m.active
    ? 'box-shadow: 0 0 0 3px rgba(211,47,47,0.35), 0 2px 8px rgba(0,0,0,0.35);'
    : 'box-shadow: 0 2px 6px rgba(0,0,0,0.35);';
  if (label) {
    return `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      <div style="width:28px;height:28px;border-radius:50%;background:#c62828;color:#fff;font:700 13px/28px system-ui,sans-serif;text-align:center;border:2px solid #fff;${ring}">${label}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #c62828;margin-top:-1px;"></div>
    </div>`;
  }
  return `<svg viewBox="0 0 24 24" width="40" height="40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45));"><path fill="${m.active ? '#b71c1c' : '#d32f2f'}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`;
}

export const PdfViewerWithClick: React.FC<PdfViewerWithClickProps> = ({
  fileUrl,
  enableContextMenu = false,
  enableClickMark = false,
  onContextMenuOnPage,
  onClickOnPage,
  marker = null,
  markers = null,
  className,
  minHeight = 400,
  markerPageOnly = false,
  zoom = 1,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);

  const resolveClickOnPage = useCallback((e: React.MouseEvent) => {
    const pageEl = (e.target as HTMLElement).closest('[data-page-number]') as HTMLElement | null;
    if (!pageEl) return null;
    const pageNumber = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
    const rect = pageEl.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { pageNumber, xPercent, yPercent };
  }, []);

  const loadPdf = useCallback(async () => {
    if (!fileUrl) return;
    setLoading(true);
    setError(null);
    try {
      const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el PDF.');
      setNumPages(0);
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableContextMenu || !onContextMenuOnPage) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = resolveClickOnPage(e);
      if (!pos) return;
      onContextMenuOnPage(pos.pageNumber, pos.xPercent, pos.yPercent, e);
    },
    [enableContextMenu, onContextMenuOnPage, resolveClickOnPage]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableClickMark || !onClickOnPage) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = resolveClickOnPage(e);
      if (!pos) return;
      onClickOnPage(pos.pageNumber, pos.xPercent, pos.yPercent, e);
    },
    [enableClickMark, onClickOnPage, resolveClickOnPage]
  );

  const pagesToRender = (() => {
    if (numPages <= 0) return [];
    if (markerPageOnly && (marker || (markers && markers.length > 0))) {
      const fromSingle = marker ? [Math.max(1, Math.min(marker.pageNumber, numPages))] : [];
      const fromMulti = markers?.length
        ? Array.from(new Set(markers.map((m) => Math.max(1, Math.min(m.pageNumber, numPages)))))
        : [];
      const pages = Array.from(new Set([...fromSingle, ...fromMulti])).sort((a, b) => a - b);
      return pages.length ? pages : Array.from({ length: numPages }, (_, i) => i + 1);
    }
    return Array.from({ length: numPages }, (_, i) => i + 1);
  })();

  useEffect(() => {
    if (!containerRef.current || numPages === 0 || !fileUrl || renderingRef.current) return;
    renderingRef.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdfDoc = await loadingTask.promise;
        const container = containerRef.current;
        if (!container || cancelled) return;

        const outputScale = window.devicePixelRatio || 1;

        for (const pageNum of pagesToRender) {
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: BASE_SCALE * zoom });
          const wrapper = document.createElement('div');
          wrapper.setAttribute('data-page-number', String(pageNum));
          wrapper.style.position = 'relative';
          wrapper.style.marginBottom = '16px';
          wrapper.style.display = 'inline-block';
          wrapper.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
          if (enableClickMark) wrapper.style.cursor = 'crosshair';
          else if (enableContextMenu) wrapper.style.cursor = 'context-menu';

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          const scale = outputScale;
          canvas.width = Math.floor(viewport.width * scale);
          canvas.height = Math.floor(viewport.height * scale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          wrapper.appendChild(canvas);

          const transform = scale !== 1 ? [scale, 0, 0, scale, 0, 0] : undefined;
          await page.render({
            canvasContext: context,
            viewport,
            transform,
          }).promise;
          if (cancelled) return;

          const pinsOnThisPage: PdfMarker[] = markers?.length
            ? markers.filter((m) => m.pageNumber === pageNum)
            : marker && marker.pageNumber === pageNum
              ? [marker]
              : [];
          pinsOnThisPage.forEach((m) => {
            const pin = document.createElement('div');
            pin.setAttribute('aria-label', m.label != null ? `Marca ${m.label}` : 'Marca de corrección');
            pin.style.position = 'absolute';
            pin.style.left = `${m.xPercent}%`;
            pin.style.top = `${m.yPercent}%`;
            pin.style.transform = 'translate(-50%, -100%)';
            pin.style.pointerEvents = 'none';
            pin.style.zIndex = m.active ? '12' : '10';
            pin.innerHTML = buildPinHtml(m);
            wrapper.appendChild(pin);
          });

          container.appendChild(wrapper);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message || 'Error al renderizar.');
      } finally {
        renderingRef.current = false;
      }
    };

    run();
    return () => {
      cancelled = true;
      const container = containerRef.current;
      if (container) {
        while (container.firstChild) container.removeChild(container.firstChild);
      }
    };
  }, [fileUrl, numPages, pagesToRender.join(','), marker?.pageNumber, marker?.xPercent, marker?.yPercent, marker?.label, marker?.active, (markers ?? []).map((m) => `${m.pageNumber}-${m.xPercent}-${m.yPercent}-${m.label ?? ''}-${m.active ? 1 : 0}`).join(','), zoom]);

  useEffect(() => {
    if (!containerRef.current) return;
    const wrappers = containerRef.current.querySelectorAll('[data-page-number]');
    wrappers.forEach((el) => {
      const node = el as HTMLElement;
      if (enableClickMark) node.style.cursor = 'crosshair';
      else if (enableContextMenu) node.style.cursor = 'context-menu';
      else node.style.cursor = 'default';
    });
  }, [enableContextMenu, enableClickMark]);

  if (loading) {
    return (
      <Box sx={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Cargando PDF…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (numPages === 0) {
    return (
      <Box sx={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">No hay páginas.</Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        height: '100%',
        minHeight,
        maxHeight: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 2,
        bgcolor: 'grey.100',
        boxSizing: 'border-box',
      }}
      onContextMenu={enableContextMenu ? handleContextMenu : undefined}
      onClick={enableClickMark ? handleClick : undefined}
    />
  );
};

export default PdfViewerWithClick;
