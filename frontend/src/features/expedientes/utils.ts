import type { RefObject } from 'react';

export function esArchivoPrevisualizable(file: File | null): boolean {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const nombre = file.name.toLowerCase();
  return (
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    nombre.endsWith('.pdf') ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(nombre)
  );
}

export function esPdfLocal(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Limpia el valor antes de abrir para que se pueda volver a elegir el mismo archivo. */
export function abrirSelectorArchivo(ref: RefObject<HTMLInputElement>): void {
  if (!ref.current) return;
  ref.current.value = '';
  ref.current.click();
}
