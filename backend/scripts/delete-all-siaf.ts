/**
 * Elimina todos los SIAFs (solicitudes, autorizaciones, bitácora, items, subproductos, adjuntos)
 * para empezar de cero con la nueva lógica (solo Dirección Departamental autoriza).
 * Ejecutar: npx ts-node scripts/delete-all-siaf.ts
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/data-source';
import { SiafBitacora, SiafAutorizacion, SiafDocumentoAdjunto, SiafItem, SiafSubproducto, SiafSolicitud } from '../src/entity/SiafSolicitud';

async function deleteAllSiaf() {
  console.log('Conectando a la base de datos...');
  await AppDataSource.initialize();

  const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
  const autRepo = AppDataSource.getRepository(SiafAutorizacion);
  const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
  const itemRepo = AppDataSource.getRepository(SiafItem);
  const subRepo = AppDataSource.getRepository(SiafSubproducto);
  const solicitudRepo = AppDataSource.getRepository(SiafSolicitud);

  try {
    const countBefore = await solicitudRepo.count();
    console.log(`SIAFs existentes: ${countBefore}`);

    await bitacoraRepo.createQueryBuilder().delete().execute();
    console.log('  Bitácora eliminada.');
    await autRepo.createQueryBuilder().delete().execute();
    console.log('  Autorizaciones eliminadas.');
    await adjuntoRepo.createQueryBuilder().delete().execute();
    console.log('  Documentos adjuntos eliminados.');
    await itemRepo.createQueryBuilder().delete().execute();
    console.log('  Items eliminados.');
    await subRepo.createQueryBuilder().delete().execute();
    console.log('  Subproductos eliminados.');
    await solicitudRepo.createQueryBuilder().delete().execute();
    console.log('  Solicitudes SIAF eliminadas.');

    const countAfter = await solicitudRepo.count();
    console.log(`\n✅ Listo. SIAFs restantes: ${countAfter}`);
  } finally {
    await AppDataSource.destroy();
    console.log('Conexión cerrada.');
  }
}

deleteAllSiaf().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
