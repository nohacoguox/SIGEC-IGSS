# Migraciones TypeORM (SIGEC-IGSS)

## Estado

- `synchronize` es **opt-in** (`DB_SYNCHRONIZE=true` solo BD vacía / primer arranque).
- Las migraciones viven en `backend/src/db/migrations/` (no confundir con `src/migrations/migrate-user-roles.ts`, que es un script aparte).
- Tabla de control: `typeorm_migrations` (en el esquema `DB_SCHEMA`, p. ej. `sigec_igss`).
- Al arrancar la API se ejecuta `AppDataSource.runMigrations()` y luego reparaciones de datos / correlativos vía `ensureSchema`.

## Comandos (desde `backend/`)

```bash
npm run migration:show      # pendientes vs aplicadas
npm run migration:run       # aplicar pendientes
npm run migration:revert    # revertir la última
npm run migration:create -- src/db/migrations/NombreCambio
npm run migration:generate -- src/db/migrations/NombreCambio
```

`migration:generate` compara **entidades vs BD actual** y escribe el SQL del diff. Úsalo después de cambiar una entity.

## Flujo recomendado al cambiar el esquema

1. Editar la entity en `src/entity/`.
2. `npm run migration:generate -- src/db/migrations/DescripcionCambio`
3. Revisar el archivo generado (sobre todo `down`).
4. Probar en local: `npm run migration:run` (o reiniciar el backend).
5. Commit de entity + migración juntos.
6. En el servidor: desplegar código y reiniciar (o `npm run migration:run`).

## BD vacía (servidor nuevo)

1. Crear base `igss` y esquema `sigec_igss`.
2. Primera vez: `DB_SYNCHRONIZE=true` → arrancar API (crea tablas desde entities).
3. Poner `DB_SYNCHRONIZE=false`.
4. Arrancar de nuevo: corre migraciones (parches históricos quedan registrados) + `ensureSchema`.

Cuando exista una migración “CreateInitialTables” completa, se podrá omitir el paso del synchronize.

## Notas técnicas

- `migrationsTransactionMode: 'each'` en el DataSource permite que una migración declare `transaction = false`.
- La migración histórica usa `transaction = false` porque, si el usuario de BD no es dueño de alguna tabla, PostgreSQL abortaría toda la transacción; así cada statement se tolera como en el antiguo `ensureSchema`.
- Cambios futuros de esquema **sí** deben ir en migraciones con transacción (por defecto) y con `down()` reversible.
