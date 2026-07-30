import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CatalogoOrigen } from './ProductoCatalogo';

@Entity('producto_catalogo_config')
export class ProductoCatalogoConfig {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  origen: CatalogoOrigen;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  encabezados: string[];

  @Column({ type: 'varchar', length: 255, name: 'columna_codigo' })
  columnaCodigo: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb", name: 'columnas_descripcion' })
  columnasDescripcion: string[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
