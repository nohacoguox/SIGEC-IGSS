/**
 * Carga la tabla departamentos y municipios desde departamentosMunicipiosData.
 * Ejecutar: npx ts-node src/seeders/SeedDepartamentosMunicipios.ts
 *
 * Puedes editar src/departamentosMunicipiosData.ts para agregar o corregir departamentos y municipios.
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Departamento } from '../entity/Departamento';
import { Municipio } from '../entity/Municipio';
import { departamentosMunicipiosData } from '../departamentosMunicipiosData';

async function seed() {
  await AppDataSource.initialize();
  const deptoRepo = AppDataSource.getRepository(Departamento);
  const muniRepo = AppDataSource.getRepository(Municipio);

  for (const { departamento: nombreDepto, municipios } of departamentosMunicipiosData) {
    let depto = await deptoRepo.findOne({ where: { nombre: nombreDepto } });
    if (!depto) {
      depto = deptoRepo.create({ nombre: nombreDepto });
      await deptoRepo.save(depto);
      console.log(`Departamento creado: ${nombreDepto}`);
    }

    for (const nombreMun of municipios) {
      const existe = await muniRepo.findOne({
        where: { nombre: nombreMun, departamento: { id: depto.id } },
      });
      if (!existe) {
        const mun = muniRepo.create({ nombre: nombreMun, departamento: depto });
        await muniRepo.save(mun);
        console.log(`  Municipio: ${nombreMun} (${nombreDepto})`);
      }
    }
  }

  await AppDataSource.destroy();
  console.log('Seed de departamentos y municipios finalizado.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
