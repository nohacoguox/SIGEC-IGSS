/**
 * Limpia SIAF + expedientes (y archivos/reservas/correlativos) para pruebas desde cero.
 * No toca usuarios, roles, unidades, catálogo de productos ni demás maestros.
 *
 * Ejecutar: npx ts-node scripts/limpiar-siaf-expedientes.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../src/data-source';
import {
  SiafBitacora,
  SiafAutorizacion,
  SiafDocumentoAdjunto,
  SiafItem,
  SiafSubproducto,
  SiafSolicitud,
} from '../src/entity/SiafSolicitud';
import {
  Expediente,
  ExpedienteDocumento,
  ExpedienteBitacora,
  ExpedienteBitacoraDetalle,
  ExpedienteDocumentoVersion,
} from '../src/entity/Expediente';
import { SiafCorrelativoReserva } from '../src/entity/SiafCorrelativoReserva';
import { SiafCorrelativoConfig } from '../src/entity/SiafCorrelativoConfig';
import { ExpedienteCorrelativoConfig } from '../src/entity/ExpedienteCorrelativoConfig';

function rmDirContents(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

async function main() {
  console.log('Conectando a la base de datos...');
  await AppDataSource.initialize();

  const schema = process.env.DB_SCHEMA || 'sigec_igss';
  const anio = new Date().getFullYear();

  try {
    const siafCount = await AppDataSource.getRepository(SiafSolicitud).count();
    const expCount = await AppDataSource.getRepository(Expediente).count();
    console.log(`Antes → SIAF: ${siafCount} | Expedientes: ${expCount}`);

    await AppDataSource.transaction(async (manager) => {
      // Expedientes (hijos primero)
      await manager.getRepository(ExpedienteBitacoraDetalle).createQueryBuilder().delete().execute();
      console.log('  expediente_bitacora_detalle');
      await manager.getRepository(ExpedienteBitacora).createQueryBuilder().delete().execute();
      console.log('  expediente_bitacora');
      await manager.getRepository(ExpedienteDocumentoVersion).createQueryBuilder().delete().execute();
      console.log('  expediente_documento_versiones');
      await manager.getRepository(ExpedienteDocumento).createQueryBuilder().delete().execute();
      console.log('  expediente_documentos');
      await manager.getRepository(Expediente).createQueryBuilder().delete().execute();
      console.log('  expedientes');

      // SIAF
      await manager.getRepository(SiafBitacora).createQueryBuilder().delete().execute();
      console.log('  siaf_bitacora');
      await manager.getRepository(SiafAutorizacion).createQueryBuilder().delete().execute();
      console.log('  siaf_autorizaciones');
      await manager.getRepository(SiafDocumentoAdjunto).createQueryBuilder().delete().execute();
      console.log('  siaf_documentos_adjuntos');
      await manager.getRepository(SiafItem).createQueryBuilder().delete().execute();
      console.log('  siaf_items');
      await manager.getRepository(SiafSubproducto).createQueryBuilder().delete().execute();
      console.log('  siaf_subproductos');
      await manager.getRepository(SiafSolicitud).createQueryBuilder().delete().execute();
      console.log('  siaf_solicitudes');

      // Reservas de correlativo SIAF
      await manager.getRepository(SiafCorrelativoReserva).createQueryBuilder().delete().execute();
      console.log('  siaf_correlativo_reservas');

      // Reiniciar secuencias de correlativo (conserva digitos / minutos_reserva)
      const siafCfg = await manager.getRepository(SiafCorrelativoConfig).find({ take: 1 });
      if (siafCfg[0]) {
        const inicio = siafCfg[0].numeroInicio || 1;
        siafCfg[0].siguienteNumero = inicio;
        siafCfg[0].anioActual = anio;
        await manager.save(siafCfg[0]);
        console.log(`  siaf_correlativo_config → siguiente=${inicio}, año=${anio}`);
      } else {
        console.log('  (sin fila siaf_correlativo_config; se creará al primer uso)');
      }

      const expCfg = await manager.getRepository(ExpedienteCorrelativoConfig).find({ take: 1 });
      if (expCfg[0]) {
        const inicio = expCfg[0].numeroInicio || 1;
        expCfg[0].siguienteNumero = inicio;
        expCfg[0].anioActual = anio;
        await manager.save(expCfg[0]);
        console.log(`  expediente_correlativo_config → siguiente=${inicio}, año=${anio}`);
      } else {
        console.log('  (sin fila expediente_correlativo_config; se creará al primer uso)');
      }
    });

    // Archivos locales (si existen)
    const uploadsRoot = path.join(__dirname, '../uploads');
    const dirs = ['siaf', 'siaf-adjuntos', 'expedientes'];
    for (const d of dirs) {
      const n = rmDirContents(path.join(uploadsRoot, d));
      if (n > 0) console.log(`  uploads/${d}: ${n} entrada(s) eliminada(s)`);
    }

    const siafAfter = await AppDataSource.getRepository(SiafSolicitud).count();
    const expAfter = await AppDataSource.getRepository(Expediente).count();
    console.log(`\nListo. Esquema ${schema} → SIAF: ${siafAfter} | Expedientes: ${expAfter}`);
    console.log('Usuarios, roles, unidades y catálogo intactos. Puede empezar las pruebas desde cero.');
  } finally {
    await AppDataSource.destroy();
    console.log('Conexión cerrada.');
  }
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
