import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('producto_catalogo')
export class ProductoCatalogo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  codigo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
