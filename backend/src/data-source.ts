import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entity/User';
import { UnidadMedica } from './entity/UnidadMedica';
import { Credential } from './entity/Credential';
import { Role } from './entity/Role';
import { Permission } from './entity/Permission';
import { Puesto } from './entity/Puesto';
import { Area } from './entity/Area';
import { Departamento } from './entity/Departamento';
import { Municipio } from './entity/Municipio';
import { SiafSolicitud, SiafItem, SiafSubproducto, SiafAutorizacion, SiafDocumentoAdjunto, SiafBitacora } from './entity/SiafSolicitud';
import { Expediente, ExpedienteDocumento, ExpedienteBitacora, ExpedienteBitacoraDetalle, ExpedienteDocumentoVersion } from './entity/Expediente';
import { ProductoCatalogo } from './entity/ProductoCatalogo';

/** Esquema SIGEC-IGSS (nombre técnico en PostgreSQL: sigec_igss; sin guiones). */
const dbSchema = process.env.DB_SCHEMA || 'sigec_igss';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin98',
  database: process.env.DB_NAME || 'igss',
  schema: dbSchema,
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    User, 
    UnidadMedica, 
    Credential, 
    Role, 
    Permission, 
    Puesto, 
    Area,
    Departamento,
    Municipio,
    SiafSolicitud,
    SiafItem,
    SiafSubproducto,
    SiafAutorizacion,
    SiafDocumentoAdjunto,
    SiafBitacora,
    Expediente,
    ExpedienteDocumento,
    ExpedienteBitacora,
    ExpedienteBitacoraDetalle,
    ExpedienteDocumentoVersion,
    ProductoCatalogo
  ],
  migrations: [],
  subscribers: [],
});
