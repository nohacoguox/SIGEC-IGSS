-- Agrega numero_orden_compra a expedientes y deja portal_app como dueño
-- (así el backend puede aplicar ALTER en el futuro).
-- Ejecutar como usuario postgres:
--   psql -h localhost -U postgres -d igss -f database/migrations/add_numero_orden_compra.sql

ALTER TABLE sigec_igss.expedientes
  ADD COLUMN IF NOT EXISTS numero_orden_compra VARCHAR(100);

ALTER TABLE sigec_igss.expedientes OWNER TO portal_app;

DROP TABLE IF EXISTS sigec_igss.expediente_orden_compra;
