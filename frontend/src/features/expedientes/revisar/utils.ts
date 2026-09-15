import type { DocEnDetalle, ExpedienteRevision } from './types';

export function nombreSolicitante(e: ExpedienteRevision): string {
  const u = e.usuario;
  if (!u) return '—';
  return [u.nombres, u.apellidos].filter(Boolean).join(' ') || '—';
}

export function origenDisplay(e: ExpedienteRevision): string {
  const texto = (e.municipioOrigen || e.unidadOrigen || (e.usuario as any)?.unidadMedica || '').trim();
  return texto || '—';
}

export function mapExpedienteRevision(e: any): ExpedienteRevision {
  return {
    id: e.id,
    numeroExpediente: e.numeroExpediente ?? '',
    titulo: e.titulo ?? '',
    descripcion: e.descripcion ?? null,
    numeroOrdenCompra: e.numeroOrdenCompra ?? null,
    estado: e.estado ?? '',
    fechaApertura: e.fechaApertura ?? e.createdAt ?? '',
    municipioOrigen: e.municipioOrigen ?? null,
    unidadOrigen: e.unidadOrigen ?? null,
    usuario: e.usuario,
  };
}

export function mapExpedienteRevisado(e: any): ExpedienteRevision {
  return {
    ...mapExpedienteRevision(e),
    ultimaAccionPorMi: e.ultimaAccionPorMi ?? null,
  };
}

export function mapDocEnDetalle(d: any): DocEnDetalle {
  return {
    id: d.id,
    tipoDocumento: d.tipoDocumento ?? '',
    nombreArchivo: d.nombreArchivo ?? '',
    mimeType: d.mimeType ?? 'application/octet-stream',
    versionActualId: d.versionActualId ?? null,
    enUltimoRechazo: !!d.enUltimoRechazo,
  };
}
