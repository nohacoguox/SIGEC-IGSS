import { Request, Response, Router } from 'express';
import { verifyToken } from '../../middleware/auth';

// El router se monta en /api/ortografia.
export const ortografiaRouter = Router();

// Ortografía: revisa texto con LanguageTool (español) y propone correcciones
const TERMINOS_INSTITUCIONALES = new Set(
  ['siaf', 'igss', 'minfin', 'sibofa', 'daf', 'dd', 'a-01', 's/c'].map((t) => t.toLowerCase())
);

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const distanciaEdicion = (a: string, b: string): number => {
  const filas = a.length + 1;
  const cols = b.length + 1;
  let previa = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < filas; i++) {
    const actual = [i];
    for (let j = 1; j < cols; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
    }
    previa = actual;
  }
  return previa[cols - 1];
};

/** true si `corta` se obtiene de `larga` quitando letras (typo por letra omitida). */
const esSubsecuencia = (corta: string, larga: string): boolean => {
  let i = 0;
  for (let j = 0; j < larga.length && i < corta.length; j++) {
    if (corta[i] === larga[j]) i++;
  }
  return i === corta.length;
};

/** Letras que el usuario escribió y el candidato no contiene (cuenta repeticiones). */
const letrasFaltantes = (base: string, candidato: string): number => {
  const disponibles = new Map<string, number>();
  for (const letra of candidato) disponibles.set(letra, (disponibles.get(letra) ?? 0) + 1);
  let faltantes = 0;
  for (const letra of base) {
    const quedan = disponibles.get(letra) ?? 0;
    if (quedan > 0) disponibles.set(letra, quedan - 1);
    else faltantes++;
  }
  return faltantes;
};

/**
 * LanguageTool ordena por similitud fonética, así que "reqiere" sugiere "refiere"
 * antes que "requiere". Se reordena favoreciendo los typos más probables al teclear:
 * el candidato debe conservar las letras que sí se escribieron.
 */
const ordenarSugerencias = (original: string, candidatos: string[]): string[] => {
  const base = sinTildes(original);
  return candidatos
    .map((candidato) => {
      const comparado = sinTildes(candidato);
      let puntaje = distanciaEdicion(base, comparado);
      puntaje += letrasFaltantes(base, comparado) * 1.5;
      if (esSubsecuencia(base, comparado)) puntaje -= 2;
      if (base[0] === comparado[0]) puntaje -= 0.5;
      if (base.length === comparado.length) puntaje -= 0.25;
      return { candidato, puntaje };
    })
    .sort((a, b) => a.puntaje - b.puntaje)
    .map((x) => x.candidato);
};

ortografiaRouter.post('/revisar', verifyToken, async (req: Request, res: Response) => {
  try {
    const texto = String(req.body?.texto ?? '').trim();
    if (!texto) {
      return res.status(400).json({ message: 'El texto a revisar es obligatorio.' });
    }
    if (texto.length > 2000) {
      return res.status(400).json({ message: 'El texto no puede superar 2000 caracteres.' });
    }

    const body = new URLSearchParams();
    body.set('text', texto);
    body.set('language', 'es');
    body.set('enabledOnly', 'false');

    const ltRes = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!ltRes.ok) {
      const detalle = await ltRes.text().catch(() => '');
      console.error('LanguageTool error:', ltRes.status, detalle);
      return res.status(502).json({
        message: 'No se pudo revisar la ortografía en este momento. Intente de nuevo en unos segundos.',
      });
    }

    const data: any = await ltRes.json();
    const matches = Array.isArray(data?.matches) ? data.matches : [];

    type Suggestion = {
      original: string;
      replacement: string;
      options: string[];
      message: string;
      offset: number;
      length: number;
    };

    const suggestions: Suggestion[] = [];
    for (const match of matches) {
      const offset = Number(match?.offset);
      const length = Number(match?.length);
      if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;

      const original = texto.slice(offset, offset + length);
      if (!original) continue;
      if (TERMINOS_INSTITUCIONALES.has(original.toLowerCase())) continue;

      const candidatos: string[] = (Array.isArray(match?.replacements) ? match.replacements : [])
        .map((r: any) => String(r?.value ?? '').trim())
        .filter((v: string) => v && v !== original);
      if (candidatos.length === 0) continue;

      const options = ordenarSugerencias(original, Array.from(new Set(candidatos))).slice(0, 6);

      suggestions.push({
        original,
        replacement: options[0],
        options,
        message: String(match?.message || 'Corrección sugerida'),
        offset,
        length,
      });
    }

    // Aplicar de atrás hacia adelante para no alterar offsets
    let corrected = texto;
    const applied = [...suggestions].sort((a, b) => b.offset - a.offset);
    for (const s of applied) {
      corrected = corrected.slice(0, s.offset) + s.replacement + corrected.slice(s.offset + s.length);
    }

    return res.json({
      original: texto,
      corrected,
      suggestions: suggestions.sort((a, b) => a.offset - b.offset),
      count: suggestions.length,
    });
  } catch (e: any) {
    console.error('Error en /api/ortografia/revisar:', e?.message || e);
    return res.status(500).json({ message: 'Error al revisar ortografía.' });
  }
});
