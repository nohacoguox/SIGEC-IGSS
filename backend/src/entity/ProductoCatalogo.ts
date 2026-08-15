import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type CatalogoOrigen = 'MINFIN' | 'SIBOFA' | 'SUBPRODUCTOS';

@Entity('producto_catalogo')
@Index('uq_producto_catalogo_origen_codigo', ['origen', 'codigo'], { unique: true })
export class ProductoCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  /** Catálogo de origen: MINFIN, SIBOFA o SUBPRODUCTOS */
  @Column({ type: 'varchar', length: 20, default: 'MINFIN' })
  origen: CatalogoOrigen;

  @Column({ type: 'varchar', length: 100 })
  codigo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  /** Fila completa del archivo original, conservando todas sus columnas. */
  @Column({ type: 'jsonb', nullable: true, name: 'datos_originales' })
  datosOriginales: Record<string, string> | null;

  /** Encabezado usado para identificar el código durante esta importación. */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'columna_codigo' })
  columnaCodigo: string | null;

  /** Encabezados elegidos, en orden, para construir la descripción. */
  @Column({ type: 'jsonb', nullable: true, name: 'columnas_descripcion' })
  columnasDescripcion: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
