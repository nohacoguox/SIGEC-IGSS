export const CATALOGO_ORIGENES = ['MINFIN', 'SIBOFA', 'SUBPRODUCTOS'] as const;

export type CatalogoOrigenApi = (typeof CATALOGO_ORIGENES)[number];

export const parseOrigen = (raw: unknown): CatalogoOrigenApi | null => {
  const v = String(raw ?? '').trim().toUpperCase();
  return (CATALOGO_ORIGENES as readonly string[]).includes(v) ? (v as CatalogoOrigenApi) : null;
};
