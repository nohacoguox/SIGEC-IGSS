-- Corrige filas de bitácora tipo 'correccion' que tienen siaf_id NULL.
-- Esas filas no aparecían porque el GET filtra por siaf_id.
-- Ajusta el número 24 por el id del SIAF al que corresponden tus correcciones (el que tiene los rechazos).
UPDATE siaf_bitacora
SET siaf_id = 24
WHERE tipo = 'correccion' AND siaf_id IS NULL;
