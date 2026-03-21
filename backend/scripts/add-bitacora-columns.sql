-- Ejecutar en la base de datos portaldigitaligss si la tabla siaf_bitacora no tiene las columnas de detalle.
-- Con synchronize: true TypeORM las crea al iniciar; use este script si synchronize está en false o si hubo error.

ALTER TABLE siaf_bitacora
  ADD COLUMN IF NOT EXISTS detalle_antes TEXT,
  ADD COLUMN IF NOT EXISTS detalle_despues TEXT;
